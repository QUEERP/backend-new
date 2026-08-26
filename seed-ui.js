const prisma = require('./src/config/prisma');
const { createInvoice } = require('./src/services/sales/invoice.service');
const { createPayment } = require('./src/services/sales/payment.service');
const { createCreditNote } = require('./src/services/sales/creditNote.service');

async function seed() {
  const businessId = '954fc9b6-d5e8-4279-97d1-6936d37d7125';
  const ts = Date.now();
  
  console.log('Seeding business:', businessId);

  // 1. Ensure Country and Currency exist
  const inr = await prisma.currency.upsert({ where: { code: 'INR' }, update: {}, create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPrecision: 2 } });
  const usd = await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPrecision: 2 } });
  const india = await prisma.country.upsert({ where: { code: 'IN' }, update: {}, create: { code: 'IN', name: 'India' } });

  // 2. Ensure Tax Framework exists
  let gstFramework = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
  if (!gstFramework) gstFramework = await prisma.taxFramework.create({ data: { name: 'India GST', countryId: india.id } });

  // 3. Update the Business to use the new relation fields
  await prisma.business.update({
    where: { id: businessId },
    data: {
      countryId: india.id,
      baseCurrencyId: inr.id,
      taxFrameworkId: gstFramework.id
    }
  });

  // 4. Ensure Exchange Rates exist
  try {
    await prisma.exchangeRate.createMany({
      data: [
        { fromCurrencyId: usd.id, toCurrencyId: inr.id, rate: 83.5, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: usd.id, toCurrencyId: inr.id, rate: 83.0, rateType: 'STATUTORY', effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: inr.id, toCurrencyId: inr.id, rate: 1, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: inr.id, toCurrencyId: inr.id, rate: 1, rateType: 'STATUTORY', effectiveDate: new Date('2026-01-01') }
      ]
    });
  } catch (e) { }

  try {
    await prisma.exchangeRateRule.create({
      data: { countryId: india.id, baseCurrencyId: usd.id, requiresStatutoryRate: true, statutoryRateSource: 'CBEC' }
    });
  } catch (e) {}

  // 5. Ensure Tax Rates exist
  let cgstType = await prisma.taxType.findFirst({ where: { taxFrameworkId: gstFramework.id, name: 'CGST' }});
  if (!cgstType) cgstType = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'CGST' }});
  let sgstType = await prisma.taxType.findFirst({ where: { taxFrameworkId: gstFramework.id, name: 'SGST' }});
  if (!sgstType) sgstType = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'SGST' }});

  let ruleIntra = await prisma.taxRule.findFirst({ where: { businessId, name: 'India Intra 18%' }});
  if (!ruleIntra) ruleIntra = await prisma.taxRule.create({ data: { businessId, name: 'India Intra 18%', rate: 18, type: 'GST', jurisdiction: 'INTRASTATE' }});
  
  await prisma.taxRate.deleteMany({ where: { taxRuleId: ruleIntra.id }});
  await prisma.taxRate.createMany({
    data: [
      { taxRuleId: ruleIntra.id, taxTypeId: cgstType.id, rate: 9, name: 'CGST 9%', effectiveFrom: new Date('2020-01-01') },
      { taxRuleId: ruleIntra.id, taxTypeId: sgstType.id, rate: 9, name: 'SGST 9%', effectiveFrom: new Date('2020-01-01') }
    ]
  });

  // 6. Ensure Customer and Product exist
  const cust = await prisma.customer.create({ data: { businessId, company: 'Staging Customer ' + ts, region: 'INDIA' } });
  const prod = await prisma.product.create({ data: { businessId, name: 'Service ' + ts, sku: `SRV-${ts}`, price: 1000, costPrice: 500, type: 'SERVICE' } });

  // 7. Inject INR Invoice + Payment + Credit Note
  console.log('Creating INR Invoice...');
  const inv1 = await createInvoice(businessId, 'admin', 'admin@test.com', {
    invoiceNumber: 'INV-INR-' + ts,
    status: 'DRAFT',
    invoiceDate: new Date(),
    currency: 'INR',
    customerId: cust.id,
    taxRuleId: ruleIntra.id,
    items: [{ productId: prod.id, description: 'Test', quantity: 1, rate: 1000 }]
  });
  await prisma.invoice.update({ where: { id: inv1.id }, data: { status: 'APPROVED' } });
  
  const pay1 = await createPayment(businessId, 'admin', 'admin@test.com', null, {
    paymentDate: new Date(),
    amount: 1180,
    paymentMethod: 'BANK_TRANSFER',
    reference: 'PAY-INR',
    allocations: [{ invoiceId: inv1.id, amountApplied: 1180 }]
  });

  console.log('Creating USD Invoice (Cross-currency) + Payment + Credit Note...');
  const inv2 = await createInvoice(businessId, 'admin', 'admin@test.com', {
    invoiceNumber: 'INV-USD-' + ts,
    status: 'DRAFT',
    invoiceDate: new Date(),
    currency: 'USD',
    customerId: cust.id,
    taxRuleId: ruleIntra.id,
    items: [{ productId: prod.id, description: 'Test', quantity: 1, rate: 100 }]
  });
  await prisma.invoice.update({ where: { id: inv2.id }, data: { status: 'APPROVED' } });
  
  // Pay USD Invoice (Full payment, let's say rate changed to 84 to create FX Gain)
  const pay2 = await createPayment(businessId, 'admin', 'admin@test.com', null, {
    paymentDate: new Date(),
    amount: 118, // 100 + 18 tax
    paymentMethod: 'BANK_TRANSFER',
    reference: 'PAY-USD',
    exchangeRate: 84.0, // Base was 83.5 -> Gain of 0.5 per USD!
    allocations: [{ invoiceId: inv2.id, amountApplied: 118 }]
  });

  // Credit Note on INR Invoice (Partial Reversal)
  console.log('Creating Credit Note...');
  const cn = await createCreditNote(businessId, 'admin', 'admin@test.com', null, {
    creditNoteNumber: 'CN-INR-' + ts,
    invoiceId: inv1.id,
    amount: 590, // 500 + 90 tax
    reason: 'Discount'
  });
  await prisma.creditNote.update({ where: { id: cn.id }, data: { status: 'APPROVED' } });

  console.log('Done seeding!');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
