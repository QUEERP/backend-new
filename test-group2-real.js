const prisma = require('./src/config/prisma');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');
const InvoiceService = require('./src/services/sales/invoice.service');
const { generateReport } = require('./src/config/reports/statutoryRegistry');

const GROUP_2_COUNTRIES = [
    { code: 'MX', fw: 'Mexico IVA' },
    { code: 'KR', fw: 'South Korea VAT' },
    { code: 'NL', fw: 'Netherlands BTW' }
];

async function testGroup2() {
  try {
    console.log("=== GROUP 2 (MX, KR, NL) E2E VERIFICATION ===\n");

    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("No user found.");

    async function runScenario(biz, customer, scenarioName, items) {
      console.log(`\n--- Scenario: ${scenarioName} ---`);
      const inv = await InvoiceService.createInvoice(biz.id, owner.id, null, {
        invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        currency: 'CAD',
        items
      });
      const dbInv = await prisma.invoice.findUnique({ where: { id: inv.id }, include: { items: true } });
      console.log(`✅ Invoice ${dbInv.invoiceNumber} created successfully.`);
      console.log(`   Subtotal: ${dbInv.subtotal}\n   Total Tax: ${dbInv.totalTax}\n   Grand Total: ${dbInv.grandTotal}`);
      return dbInv;
    }

    for (let c of GROUP_2_COUNTRIES) {
        console.log(`\n======================================================\nTESTING COUNTRY: ${c.code}\n======================================================`);
        const biz = await prisma.business.create({ data: { name: `${c.code} Test Biz`, countryCode: c.code, baseCurrency: { connect: { code: 'CAD' } }, owner: { connect: { id: owner.id } } } });
        await provisionTaxRules(biz.id, c.code);
        
        // Link the framework to the business so the engine calculates taxes
        const fw = await prisma.taxFramework.findFirst({ where: { name: c.fw } });
        await prisma.business.update({ where: { id: biz.id }, data: { taxFrameworkId: fw.id } });
        
        const domCust = await prisma.customer.create({ data: { businessId: biz.id, country: c.code, company: 'Test Corp', region: 'UNITED_KINGDOM' } });
        const forCust = await prisma.customer.create({ data: { businessId: biz.id, country: 'US', company: 'Foreign Corp', region: 'UNITED_KINGDOM' } });
        const p1 = await prisma.product.create({ data: { businessId: biz.id, name: 'Standard Item', type: 'GOODS', price: 1000, sku: `SKU-${Date.now()}`, costPrice: 500 } });
        const p2 = await prisma.product.create({ data: { businessId: biz.id, name: 'Service Item', type: 'SERVICE', price: 1000, sku: `SKU-SVC-${Date.now()}`, costPrice: 500 } });
        
        const domInv = await runScenario(biz, domCust, 'Standard Domestic Sale (Goods)', [{ productId: p1.id, quantity: 1, price: 1000, description: 'Test Goods' }]);
        await runScenario(biz, domCust, 'Standard Domestic Sale (Services)', [{ productId: p2.id, quantity: 1, price: 1000, description: 'Test Services' }]);
        await runScenario(biz, forCust, 'Cross-border (Zero Rated)', [{ productId: p1.id, quantity: 1, price: 1000, description: 'Test Item' }]);
        
        // Test Debit Note
        console.log('\n--- Scenario: Debit Note ---');
        try {
            const dn = await InvoiceService.createInvoice(biz.id, owner.id, null, {
                invoiceNumber: `DN-${Date.now().toString().slice(-4)}`,
                customerId: domCust.id,
                currency: 'CAD',
                items: [{ productId: p1.id, quantity: 1, price: 50, description: 'Debit Note adjustment' }],
                originalInvoiceId: domInv.id,
                isDebitNote: true
            });
            console.log(`✅ Debit Note ${dn.invoiceNumber} created successfully.`);
        } catch (e) {
            console.log(`❌ Debit Note error: ${e.message}`);
        }

        // Test manual override
        console.log('\n--- Scenario: Manual Override (Permission Denied) ---');
        try {
          await runScenario(biz, domCust, 'Manual Override (Permission Denied)', [{ productId: p1.id, quantity: 1, price: 1000, description: 'Test Item', isManualOverride: true, overrideTaxRate: 0, overrideReason: 'Manual adjustment' }]);
        } catch (e) {
          console.log(`✅ Caught expected error: ${e.message}`);
        }
        
        console.log(`\nPulling Statutory Report for ${c.fw}...`);
        try {
            const reportCode = `${c.fw.toUpperCase().replace(/[\s/]+/g, '_')}_GENERIC_RETURN`;
            const report = await generateReport(c.fw, reportCode, biz.id, { period: 'Q3-2026' });
            console.log(`\n--- Statutory Report Output (${c.code}) ---`);
            console.log(JSON.stringify(report, null, 2));
        } catch (e) {
            console.log("Report generation failed or not implemented:", e.message);
        }
    }
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testGroup2();
