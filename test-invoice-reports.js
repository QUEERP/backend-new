const prisma = require('./src/config/prisma');
const { createInvoice } = require('./src/services/sales/invoice.service');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
const TransactionHelper = require('./src/services/TransactionHelper');

async function runTests() {
  try {
    console.log("=== 1. CANADA INVOICE TEST ===");
    // Find the CA business we created earlier
    const caBusiness = await prisma.business.findFirst({
      where: { countryCode: 'CA', name: { startsWith: 'Test Biz CA' } },
      orderBy: { createdAt: 'desc' }
    });

    if (!caBusiness) {
      console.log("No Canada business found. Run audit-and-test.js first.");
      return;
    }
    
    // Find a customer or create one
    let customer = await prisma.customer.findFirst({ where: { businessId: caBusiness.id } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { businessId: caBusiness.id, company: 'Canada Company', region: 'CANADA' }
      });
    }

    // Get the GST rate rule to attach to the item
    const gstRule = await prisma.taxRule.findFirst({
      where: { businessId: caBusiness.id, name: 'CA GST 5%' }
    });
    const hstRule = await prisma.taxRule.findFirst({
      where: { businessId: caBusiness.id, name: 'CA HST 13%' }
    });

    // We create TWO invoices to show CAD and USD currencies since currency is at the document level
    console.log(`Creating CAD Invoice...`);
    const invCAD = await createInvoice(caBusiness.id, caBusiness.ownerId, 'test@example.com', {
      customerId: customer.id,
      currency: 'CAD',
      items: [
        { description: 'Consulting CAD', quantity: 1, price: 1000, taxPercent: gstRule?.rate || 5, taxRuleId: gstRule?.id }
      ]
    });
    console.log(`Created CAD Invoice: ${invCAD.invoiceNumber} - Grand Total: ${invCAD.grandTotal}`);

    // Seed USD currency and exchange rate to CAD for this test
    let cadCurrency = await prisma.currency.findUnique({ where: { code: 'CAD' } });
    if (!cadCurrency) {
      cadCurrency = await prisma.currency.create({ data: { code: 'CAD', name: 'Canadian Dollar', symbol: '$' } });
    }
    let usdCurrency = await prisma.currency.findUnique({ where: { code: 'USD' } });
    if (!usdCurrency) {
      usdCurrency = await prisma.currency.create({ data: { code: 'USD', name: 'US Dollar', symbol: '$' } });
    }
    
    // Update business with baseCurrency if missing
    await prisma.business.update({ where: { id: caBusiness.id }, data: { baseCurrencyId: cadCurrency.id } });

    // Seed ExchangeRate
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: usdCurrency.id,
        toCurrencyId: cadCurrency.id,
        rate: 1.35,
        rateType: 'COMMERCIAL',
        effectiveDate: new Date()
      }
    });

    console.log(`Creating USD Invoice...`);
    const invUSD = await createInvoice(caBusiness.id, caBusiness.ownerId, 'test@example.com', {
      customerId: customer.id,
      currency: 'USD',
      items: [
        { description: 'Software USD', quantity: 1, price: 500, taxPercent: hstRule?.rate || 13, taxRuleId: hstRule?.id }
      ]
    });
    console.log(`Created USD Invoice: ${invUSD.invoiceNumber} - Grand Total: ${invUSD.grandTotal} USD`);

    // Fetch Tax Reports (Statutory & Transactions)
    console.log("\n--- Statutory Report (CA) ---");
    const reportRes = await statutoryRegistry.generateReport('Canada GST/HST', 'CA_GST_HST_RETURN', caBusiness.id, {});
    console.log(JSON.stringify(reportRes, null, 2));

    console.log("\n--- Tax Transactions ---");
    const taxTxns = await prisma.taxTransaction.findMany({ 
      where: { businessId: caBusiness.id },
      include: { taxRate: { include: { taxType: true } } }
    });
    const formattedTaxes = taxTxns.map(t => ({
      txnId: t.transactionId,
      taxType: t.taxRate?.taxType?.name,
      taxableAmountBase: t.taxableAmountBaseCcy,
      taxAmountBase: t.taxAmountBaseCcy,
      currency: t.transactionCurrencyId
    }));
    console.log(JSON.stringify(formattedTaxes, null, 2));

    console.log("\n--- Currency Report Data ---");
    const invoices = await prisma.invoice.findMany({ 
      where: { businessId: caBusiness.id }, 
      include: { transactionCurrency: true } 
    });
    const currencyMap = {};
    invoices.forEach(doc => {
      if (doc.transactionCurrency) {
        currencyMap[doc.transactionCurrency.code] = doc.exchangeRate;
      }
    });
    console.log(JSON.stringify(currencyMap, null, 2));


    console.log("\n=== 2. INDIA AND UAE TAX CALCULATION FIX VERIFICATION ===");
    
    // Self-contained India test
    let inrCurrency = await prisma.currency.findUnique({ where: { code: 'INR' } });
    if (!inrCurrency) inrCurrency = await prisma.currency.create({ data: { code: 'INR', name: 'Indian Rupee', symbol: '₹' } });
    
    let inCountry = await prisma.country.upsert({ where: { code: 'IN' }, update: {}, create: { code: 'IN', name: 'India' }});

    const mockInBusiness = await prisma.business.create({
      data: { name: 'Mock IN Biz', ownerId: caBusiness.ownerId, countryId: inCountry.id, baseCurrencyId: inrCurrency.id }
    });
    const inTaxRule = await prisma.taxRule.create({
      data: { businessId: mockInBusiness.id, name: 'India Intra GST 18%', rate: 18, type: 'GST', jurisdiction: 'INTRASTATE', autoProvisioned: true }
    });
    
    // We need tax rates for the tax rule to work with split rates
    const inFw = await prisma.taxFramework.upsert({ where: { countryId: inCountry.id }, update: {}, create: { name: 'Mock India GST', countryId: inCountry.id } });
    
    // Link framework to business
    await prisma.business.update({ where: { id: mockInBusiness.id }, data: { taxFrameworkId: inFw.id } });
    
    const cgstType = await prisma.taxType.create({ data: { name: 'CGST', taxFrameworkId: inFw.id } });
    const sgstType = await prisma.taxType.create({ data: { name: 'SGST', taxFrameworkId: inFw.id } });
    const cgstRate = await prisma.taxRate.create({ data: { taxTypeId: cgstType.id, name: 'CGST 9%', rate: 9, effectiveFrom: new Date('2000-01-01') } });
    const sgstRate = await prisma.taxRate.create({ data: { taxTypeId: sgstType.id, name: 'SGST 9%', rate: 9, effectiveFrom: new Date('2000-01-01') } });
    
    await prisma.taxRule.update({
      where: { id: inTaxRule.id },
      data: { rates: { connect: [{ id: cgstRate.id }, { id: sgstRate.id }] } }
    });

    const inFin = await TransactionHelper.processTransactionFinancials({
      businessId: mockInBusiness.id,
      transactionDate: new Date(),
      currencyCode: 'INR',
      items: [{ description: 'Item', quantity: 1, price: 1000, taxPercent: 18, taxRuleId: inTaxRule.id }],
      customerId: null,
      globalDiscount: 0,
      txClient: prisma
    });
    console.log(`India 18% Intrastate Tax on 1000 INR -> Expected 180. Actual: ${inFin.totalTax}`);


    // Self-contained UAE test
    let aedCurrency = await prisma.currency.findUnique({ where: { code: 'AED' } });
    if (!aedCurrency) aedCurrency = await prisma.currency.create({ data: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' } });
    
    let aeCountry = await prisma.country.upsert({ where: { code: 'AE' }, update: {}, create: { code: 'AE', name: 'UAE' }});

    const mockAeBusiness = await prisma.business.create({
      data: { name: 'Mock AE Biz', ownerId: caBusiness.ownerId, countryId: aeCountry.id, baseCurrencyId: aedCurrency.id }
    });
    const aeTaxRule = await prisma.taxRule.create({
      data: { businessId: mockAeBusiness.id, name: 'UAE Standard VAT 5%', rate: 5, type: 'VAT', autoProvisioned: true }
    });
    
    const aeFw = await prisma.taxFramework.upsert({ where: { countryId: aeCountry.id }, update: {}, create: { name: 'Mock UAE VAT', countryId: aeCountry.id } });
    
    // Link framework to business
    await prisma.business.update({ where: { id: mockAeBusiness.id }, data: { taxFrameworkId: aeFw.id } });
    
    const vatType = await prisma.taxType.create({ data: { name: 'VAT_STANDARD', taxFrameworkId: aeFw.id } });
    const vatRate = await prisma.taxRate.create({ data: { taxTypeId: vatType.id, name: 'VAT 5%', rate: 5, effectiveFrom: new Date('2000-01-01') } });
    
    await prisma.taxRule.update({
      where: { id: aeTaxRule.id },
      data: { rates: { connect: [{ id: vatRate.id }] } }
    });

    const aeFin = await TransactionHelper.processTransactionFinancials({
      businessId: mockAeBusiness.id,
      transactionDate: new Date(),
      currencyCode: 'AED',
      items: [{ description: 'Item', quantity: 1, price: 1000, taxPercent: 5, taxRuleId: aeTaxRule.id }],
      customerId: null,
      globalDiscount: 0,
      txClient: prisma
    });
    console.log(`UAE 5% VAT on 1000 AED -> Expected 50. Actual: ${aeFin.totalTax}`);

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
