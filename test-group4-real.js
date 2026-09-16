const prisma = require('./src/config/prisma');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');
const TransactionHelper = require('./src/services/TransactionHelper');
const reportController = require('./src/controllers/reportController');

async function runGroup3() {
  try {
    const owner = await prisma.user.findFirst();
    // Group 3: CH, TH, VN, PH, MY, CN
    const countries = [
      { code: 'CH', fw: 'Switzerland MWST' },
      { code: 'TH', fw: 'Poland VAT' },
      { code: 'VN', fw: 'Sweden Moms' },
      { code: 'PH', fw: 'Norway MVA' },
      { code: 'MY', fw: 'Belgium TVA/BTW' },
      { code: 'CN', fw: 'Austria USt' }
    ];

    for (const c of countries) {
        console.log(`\n======================================================\nTESTING COUNTRY: ${c.code}\n======================================================`);
        const biz = await prisma.business.create({ data: { name: `${c.code} Test Biz`, countryCode: c.code, baseCurrency: { connect: { code: 'CAD' } }, owner: { connect: { id: owner.id } } } });
        await provisionTaxRules(biz.id, c.code);

        // Link the framework to the business so the engine calculates taxes
        const fw = await prisma.taxFramework.findFirst({ where: { name: c.fw } });
        await prisma.business.update({ where: { id: biz.id }, data: { taxFrameworkId: fw.id } });

        const domCust = await prisma.customer.create({ data: { businessId: biz.id, country: c.code, company: 'Test Corp', region: 'UNITED_KINGDOM' } });
        const forCust = await prisma.customer.create({ data: { businessId: biz.id, country: 'US', company: 'Foreign Corp', region: 'UNITED_KINGDOM' } });
        const p1 = await prisma.product.create({ data: { businessId: biz.id, name: 'Standard Item', type: 'GOODS', price: 1000, sku: `SKU-${Date.now()}`, costPrice: 500 } });
        const s1 = await prisma.product.create({ data: { businessId: biz.id, name: 'Standard Service', type: 'SERVICE', price: 1000, sku: `SRV-${Date.now()}`, costPrice: 500 } });

        const createInv = async (cust, items, type = 'INVOICE') => {
            return await prisma.$transaction(async (tx) => {
              const inv = await tx.invoice.create({ data: { businessId: biz.id, customerId: cust.id, invoiceDate: new Date(), dueDate: new Date(), invoiceNumber: `INV-${Date.now()}`, status: 'DRAFT', subtotal: 0, totalTax: 0, grandTotal: 0 } });
              let sub = 0;
              for (const i of items) {
                await tx.invoiceItem.create({ data: { invoiceId: inv.id, productId: i.productId, quantity: i.quantity, rate: i.price, amount: i.price * i.quantity, description: 'Test', hours: 0 } });
                sub += i.price * i.quantity;
              }
              const calcItems = items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }));
              const financials = await TransactionHelper.processTransactionFinancials({
                transactionType: type, transactionId: inv.id, businessId: biz.id, customerId: cust.id, items: calcItems, currencyCode: 'CAD', transactionDate: new Date(), userId: owner.id, txClient: tx
              });
              await TransactionHelper.saveTaxLedger(tx, biz.id, type, inv.id, financials.taxTransactions);
              
              // Update invoice with financials
              await tx.invoice.update({
                where: { id: inv.id },
                data: {
                  subtotal: financials.subtotal,
                  totalTax: financials.totalTax,
                  grandTotal: financials.subtotal + financials.totalTax
                }
              });
              return inv;
            }, { timeout: 20000 });
        };

        console.log("\n--- Scenario: Standard Domestic Sale (Goods) ---");
        const inv1 = await createInv(domCust, [{ productId: p1.id, quantity: 1, price: 1000 }]);
        const dbInv1 = await prisma.invoice.findUnique({ where: { id: inv1.id }});
        console.log(`✅ Invoice ${dbInv1.invoiceNumber} created successfully.\n   Subtotal: ${dbInv1.subtotal}\n   Total Tax: ${dbInv1.totalTax}\n   Grand Total: ${dbInv1.grandTotal}`);

        console.log("\n--- Scenario: Standard Domestic Sale (Services) ---");
        const inv2 = await createInv(domCust, [{ productId: s1.id, quantity: 1, price: 1000 }]);
        const dbInv2 = await prisma.invoice.findUnique({ where: { id: inv2.id }});
        console.log(`✅ Invoice ${dbInv2.invoiceNumber} created successfully.\n   Subtotal: ${dbInv2.subtotal}\n   Total Tax: ${dbInv2.totalTax}\n   Grand Total: ${dbInv2.grandTotal}`);

        console.log("\n--- Scenario: Cross-border (Zero Rated) ---");
        const inv3 = await createInv(forCust, [{ productId: p1.id, quantity: 1, price: 1000 }]);
        const dbInv3 = await prisma.invoice.findUnique({ where: { id: inv3.id }});
        console.log(`✅ Invoice ${dbInv3.invoiceNumber} created successfully.\n   Subtotal: ${dbInv3.subtotal}\n   Total Tax: ${dbInv3.totalTax}\n   Grand Total: ${dbInv3.grandTotal}`);

        console.log("\n--- Scenario: Debit Note ---");
        const inv4 = await createInv(domCust, [{ productId: p1.id, quantity: 1, price: 50 }], 'DEBIT_NOTE');
        const dbInv4 = await prisma.invoice.findUnique({ where: { id: inv4.id }});
        console.log(`✅ Debit Note ${dbInv4.invoiceNumber} created successfully.`);

        console.log("\n--- Scenario: Manual Override (Permission Denied) ---");
        try {
            await prisma.$transaction(async (tx) => {
              const inv5 = await tx.invoice.create({ data: { businessId: biz.id, customerId: domCust.id, invoiceDate: new Date(), dueDate: new Date(), invoiceNumber: `INV-${Date.now()}`, status: 'DRAFT', subtotal: 0, totalTax: 0, grandTotal: 0 } });
              await tx.invoiceItem.create({ data: { invoiceId: inv5.id, productId: p1.id, quantity: 1, rate: 1000, amount: 1000, hours: 0, description: 'Test' } });
              await TransactionHelper.processTransactionFinancials({
                transactionType: 'INVOICE', transactionId: inv5.id, businessId: biz.id, customerId: domCust.id, items: [{ productId: p1.id, quantity: 1, price: 1000, isManualOverride: true, overrideTaxRate: 5, manualOverrideReason: 'Testing' }], currencyCode: 'CAD', transactionDate: new Date(), userId: owner.id, txClient: tx
              });
            }, { timeout: 20000 });
            console.log("❌ ERROR: Manual override succeeded but should have been denied!");
        } catch (e) {
            console.log(`✅ Caught expected error: ${e.message}`);
        }

        const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
        console.log(`\nPulling Statutory Report for ${c.fw}...`);
        const reportCode = `${c.fw.toUpperCase().replace(/[\s/]+/g, '_')}_GENERIC_RETURN`;
        const reportData = await statutoryRegistry.generateReport(c.fw, reportCode, biz.id, { fromDate: '2026-01-01', toDate: '2026-12-31' });
        console.log(`\n--- Statutory Report Output (${c.code}) ---\n${JSON.stringify(reportData, null, 2)}`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
runGroup3();
