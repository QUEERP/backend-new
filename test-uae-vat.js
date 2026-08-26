const prisma = require('./src/config/prisma');
const { createInvoice } = require('./src/services/sales/invoice.service');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');

async function runUAETest() {
  try {
    const uae = await prisma.country.findUnique({ where: { code: 'AE' } }) || await prisma.country.findFirst();
    const aed = await prisma.currency.findUnique({ where: { code: 'AED' } });
    const uaeFramework = await prisma.taxFramework.findFirst({ where: { name: 'UAE VAT' } });
    
    if (!uae || !aed || !uaeFramework) {
      console.error("Missing AE country, AED currency, or UAE VAT framework setup");
      return;
    }
    
    const user = await prisma.user.findFirst();
    
    const business = await prisma.business.create({
      data: {
        name: "UAE VAT Test Biz",
        baseCurrencyId: aed.id,
        countryId: uae.id,
        ownerId: user.id,
        taxFrameworkId: uaeFramework.id
      }
    });

    console.log(`Created UAE Business: ${business.id}`);

    // Setup Tax Types
    const standardType = await prisma.taxType.findFirst({ where: { name: 'VAT_STANDARD' } }) 
      || await prisma.taxType.create({ data: { name: 'VAT_STANDARD', taxFrameworkId: uaeFramework.id } });
      
    const reverseType = await prisma.taxType.findFirst({ where: { name: 'VAT_REVERSE_CHARGE' } }) 
      || await prisma.taxType.create({ data: { name: 'VAT_REVERSE_CHARGE', taxFrameworkId: uaeFramework.id } });

    // Set up tax rules (VAT_STANDARD 5%, VAT_ZERO 0%, VAT_EXEMPT 0%, VAT_REVERSE_CHARGE 5%)
    const standardRule = await prisma.taxRule.create({
      data: {
        businessId: business.id,
        name: "UAE Standard 5%",
        rate: 5,
        type: "VAT",
        rates: {
          create: [{
            name: "VAT 5%",
            rate: 5,
            effectiveFrom: new Date('2020-01-01'),
            taxTypeId: standardType.id
          }]
        }
      }
    });

    const reverseRule = await prisma.taxRule.create({
      data: {
        businessId: business.id,
        name: "UAE Reverse Charge 5%",
        rate: 5, 
        type: "VAT",
        jurisdiction: "REVERSE_CHARGE", 
        rates: {
          create: [{
            name: "VAT Reverse 5%",
            rate: 5,
            effectiveFrom: new Date('2020-01-01'),
            taxTypeId: reverseType.id
          }]
        }
      }
    });

    // Customer / Vendor
    const customer = await prisma.customer.create({
      data: { businessId: business.id, company: 'UAE Customer', region: 'UAE' }
    });
    
    const vendor = await prisma.vendor.create({
      data: { businessId: business.id, name: 'UAE Vendor' }
    });

    // 1. Standard Rated Invoice (Box 1)
    await createInvoice(business.id, user.id, user.email, {
      customerId: customer.id,
      invoiceNumber: 'INV-UAE-01',
      currency: 'AED',
      items: [{ description: 'Standard Supply', quantity: 1, rate: 1000, taxPercent: 5 }]
    });

    // 2. Reverse Charge Bill (Box 3 & Box 10)
    // To trigger reverseRule, we can hack the DB directly for test if taxEngine falls back, 
    // or just pass a specific state. Let's create the bill directly using tax engine with jurisdiction.
    const { processTransactionFinancials } = require('./src/services/TransactionHelper');
    await prisma.$transaction(async tx => {
      const bill = await tx.bill.create({
        data: {
          businessId: business.id,
          vendorId: vendor.id,
          billNumber: "BILL-UAE-RC",
          currency: "AED",
          transactionCurrencyId: aed.id,
          baseCurrencyId: aed.id,
          subtotal: 2000,
          tax: 100, // 5%
          totalAmount: 2100,
          baseCurrencyAmount: 2100,
          status: "UNPAID",
          dueDate: new Date(),
          billDate: new Date()
        }
      });
      // create the tax transaction
      await tx.taxTransaction.create({
         data: {
           businessId: business.id,
           transactionType: 'BILL',
           transactionId: bill.id,
           taxRateId: (await prisma.taxRate.findFirst({ where: { taxRuleId: reverseRule.id } })).id,
           taxAmountTxnCcy: 100,
           taxAmountBaseCcy: 100,
           taxableAmountBaseCcy: 2000,
           transactionCurrencyId: aed.id
         }
      });
    });

    // Run Reports
    console.log("\n--- UAE VAT RETURN (FORM 201) ---");
    const vatReturn = await statutoryRegistry.generateReport('UAE VAT', 'UAE_VAT_RETURN', business.id, {});
    console.log(JSON.stringify(vatReturn.data.filter(b => b.amount > 0 || b.vatAmount > 0), null, 2));

    console.log("\n--- OUTPUT TAX REGISTER ---");
    const outputRegister = await statutoryRegistry.generateReport('UAE VAT', 'UAE_VAT_OUTPUT', business.id, {});
    console.log(JSON.stringify(outputRegister.data, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

runUAETest();
