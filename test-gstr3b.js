const prisma = require('./src/config/prisma');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
const crypto = require('crypto');

async function runGSTR3BTest() {
  try {
    const india = await prisma.country.findUnique({ where: { code: 'IN' } }) || await prisma.country.findFirst();
    const inr = await prisma.currency.findUnique({ where: { code: 'INR' } });
    const gstFramework = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
    
    if (!india || !inr || !gstFramework) {
      console.error("Missing IN country, INR currency, or India GST framework setup");
      return;
    }
    
    const user = await prisma.user.findFirst();
    
    const business = await prisma.business.create({
      data: {
        name: "GSTR-3B Test Biz",
        baseCurrencyId: inr.id,
        countryId: india.id,
        ownerId: user.id,
        taxFrameworkId: gstFramework.id
      }
    });

    console.log(`Created India Business: ${business.id}`);

    // Setup Tax Types
    const cgstType = await prisma.taxType.findFirst({ where: { name: 'CGST' } }) || await prisma.taxType.create({ data: { name: 'CGST', taxFrameworkId: gstFramework.id } });
    const sgstType = await prisma.taxType.findFirst({ where: { name: 'SGST' } }) || await prisma.taxType.create({ data: { name: 'SGST', taxFrameworkId: gstFramework.id } });
    const igstType = await prisma.taxType.findFirst({ where: { name: 'IGST' } }) || await prisma.taxType.create({ data: { name: 'IGST', taxFrameworkId: gstFramework.id } });

    // Setup Tax Rules & Rates
    const stdRule = await prisma.taxRule.create({
      data: { businessId: business.id, name: "Intra 18%", rate: 18, type: "GST", jurisdiction: "INTRASTATE", taxCategory: null }
    });
    const cgstRate = await prisma.taxRate.create({ data: { name: "CGST 9%", rate: 9, effectiveFrom: new Date('2020-01-01'), taxTypeId: cgstType.id, taxRuleId: stdRule.id }});
    const sgstRate = await prisma.taxRate.create({ data: { name: "SGST 9%", rate: 9, effectiveFrom: new Date('2020-01-01'), taxTypeId: sgstType.id, taxRuleId: stdRule.id }});

    const zeroRule = await prisma.taxRule.create({
      data: { businessId: business.id, name: "Zero Rated Export", rate: 0, type: "GST", jurisdiction: "INTERSTATE", taxCategory: "ZERO_RATED" }
    });
    const zeroRate = await prisma.taxRate.create({ data: { name: "IGST 0%", rate: 0, effectiveFrom: new Date('2020-01-01'), taxTypeId: igstType.id, taxRuleId: zeroRule.id }});

    const nilRule = await prisma.taxRule.create({
      data: { businessId: business.id, name: "Nil Rated", rate: 0, type: "GST", jurisdiction: "INTRASTATE", taxCategory: null }
    });
    const cgstNil = await prisma.taxRate.create({ data: { name: "CGST 0%", rate: 0, effectiveFrom: new Date('2020-01-01'), taxTypeId: cgstType.id, taxRuleId: nilRule.id }});

    const rcRule = await prisma.taxRule.create({
      data: { businessId: business.id, name: "Reverse Charge Intra", rate: 5, type: "GST", jurisdiction: "INTRASTATE", taxCategory: "REVERSE_CHARGE" }
    });
    const cgstRcRate = await prisma.taxRate.create({ data: { name: "CGST RC 2.5%", rate: 2.5, effectiveFrom: new Date('2020-01-01'), taxTypeId: cgstType.id, taxRuleId: rcRule.id }});
    const sgstRcRate = await prisma.taxRate.create({ data: { name: "SGST RC 2.5%", rate: 2.5, effectiveFrom: new Date('2020-01-01'), taxTypeId: sgstType.id, taxRuleId: rcRule.id }});

    // Helper to create TaxTransaction directly
    const createTx = async (type, taxable, taxAmt, rateId) => {
      await prisma.taxTransaction.create({
         data: {
           businessId: business.id,
           transactionType: type,
           transactionId: crypto.randomUUID(),
           taxRateId: rateId,
           taxAmountTxnCcy: taxAmt,
           taxAmountBaseCcy: taxAmt,
           taxableAmountBaseCcy: taxable,
           transactionCurrencyId: inr.id
         }
      });
    };

    // 1. Standard Intra-State Invoice: 1000 taxable + 90 CGST + 90 SGST
    await createTx('INVOICE', 1000, 90, cgstRate.id);
    await createTx('INVOICE', 1000, 90, sgstRate.id);

    // 2. Zero-Rated Export Invoice: 2000 taxable + 0 IGST
    await createTx('INVOICE', 2000, 0, zeroRate.id);

    // 3. Nil-Rated Invoice: 3000 taxable + 0 CGST
    await createTx('INVOICE', 3000, 0, cgstNil.id);

    // 4. Reverse Charge Bill: 4000 taxable + 100 CGST + 100 SGST
    await createTx('BILL', 4000, 100, cgstRcRate.id);
    await createTx('BILL', 4000, 100, sgstRcRate.id);

    // 5. Regular Bill: 5000 taxable + 450 CGST + 450 SGST
    await createTx('BILL', 5000, 450, cgstRate.id);
    await createTx('BILL', 5000, 450, sgstRate.id);

    // 6. Purchase Return: -1000 taxable + -90 CGST + -90 SGST
    await createTx('PURCHASE_RETURN', 1000, 90, cgstRate.id);
    await createTx('PURCHASE_RETURN', 1000, 90, sgstRate.id);

    // Run Reports
    console.log("\n--- GSTR-3B ---");
    const gstr3b = await statutoryRegistry.generateReport('India GST', 'GSTR3B', business.id, {});
    console.log(JSON.stringify(gstr3b, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

runGSTR3BTest();
