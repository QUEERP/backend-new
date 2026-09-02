const prisma = require('./src/config/prisma');
const TaxResolver = require('./src/services/TaxResolver');
const TransactionHelper = require('./src/services/TransactionHelper');
const billService = require('./src/services/purchase/bill.service');
const debitNoteService = require('./src/services/purchase/debitNote.service');

async function testUAETax() {
  let businessId;
  let taxFramework;
  try {
    taxFramework = await prisma.taxFramework.findFirst();
    if (!taxFramework) throw new Error("No tax framework found.");
    let aedCurrency = await prisma.currency.findFirst({ where: { code: 'AED' } });
    if (!aedCurrency) {
        aedCurrency = await prisma.currency.create({
            data: { code: 'AED', name: 'UAE Dirham', symbol: 'AED' }
        });
    }

    const business = await prisma.business.create({
      data: {
        name: 'UAE Test E2E ' + Date.now(),
        taxFramework: { connect: { id: taxFramework.id } },
        countryCode: 'AE',
        state: 'DXB',
        baseCurrency: { connect: { id: aedCurrency.id } },
        owner: {
            create: {
                name: "Test User",
                email: 'owner_uae_' + Date.now() + '@test.com',
                password: "hash123",
                role: "ADMIN"
            }
        }
      }
    });
    businessId = business.id;
    console.log("Created isolated UAE Business:", businessId);

    const taxType = await prisma.taxType.create({ data: { name: 'VAT', taxFrameworkId: taxFramework.id } });

    // UAE Rules Setup
    // 1. Domestic Standard (5%)
    const domesticRule = await prisma.taxRule.create({
      data: { businessId, name: "Domestic Standard 5%", rate: 5, type: "STANDARD", isRecoverable: true, priority: 20, countryCode: 'AE', placeOfSupply: 'INTRASTATE', supplyCategory: 'GOODS' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: domesticRule.id, name: "Domestic Rate", rate: 5, effectiveFrom: new Date('2020-01-01') } });

    // 2. Export (0%)
    const exportRule = await prisma.taxRule.create({
      data: { businessId, name: "Export 0%", rate: 0, type: "ZERO_RATED", isRecoverable: true, priority: 10, countryCode: 'AE', placeOfSupply: 'EXPORT', supplyCategory: 'GOODS' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: exportRule.id, name: "Export Rate", rate: 0, effectiveFrom: new Date('2020-01-01') } });

    // 3. Domestic Services (5%)
    const domesticServicesRule = await prisma.taxRule.create({
      data: { businessId, name: "Domestic Services 5%", rate: 5, type: "STANDARD", isRecoverable: true, priority: 20, countryCode: 'AE', placeOfSupply: 'INTRASTATE', supplyCategory: 'SERVICES' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: domesticServicesRule.id, name: "Services Rate", rate: 5, effectiveFrom: new Date('2020-01-01') } });

    // 4. Reverse Charge (5%) for Imported Services from Unregistered Vendor
    // Note: Implementing Option (b) - this will just record the 5% correctly under REVERSE_CHARGE type,
    // explicitly NOT posting the dual-ledger self-assessment right now.
    const reverseChargeRule = await prisma.taxRule.create({
      data: { businessId, name: "Reverse Charge 5%", rate: 5, type: "REVERSE_CHARGE", isRecoverable: true, priority: 5, countryCode: 'AE', placeOfSupply: 'IMPORT', supplyCategory: 'SERVICES', counterpartyTaxRegistrationStatus: 'UNREGISTERED' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: reverseChargeRule.id, name: "RC Rate", rate: 5, effectiveFrom: new Date('2020-01-01') } });

    // Vendors
    const domesticVendor = await prisma.vendor.create({
      data: { businessId, name: 'UAE Domestic Vendor', country: 'AE', state: 'DXB', taxNumber: "VAT-UAE-1" }
    });
    
    const foreignVendor = await prisma.vendor.create({
      data: { businessId, name: 'US Foreign Vendor (Unregistered)', country: 'US', state: 'NY' } // No taxNumber
    });

    // Customers
    const foreignCustomer = await prisma.customer.create({
      data: { businessId, company: 'UK Corp', country: 'UK', state: 'London', region: 'UNITED_KINGDOM' }
    });

    // Products
    const goodsProduct = await prisma.product.create({ 
      data: { 
        name: 'Standard Physical Goods', 
        type: 'GOODS', 
        sku: `SKU-GOODS-UAE-${Date.now()}`,
        price: 1000,
        costPrice: 500,
        businessId: business.id 
      } 
    });

    const servicesProduct = await prisma.product.create({ 
      data: { 
        name: 'Consulting Services', 
        type: 'SERVICE', 
        sku: `SKU-SVC-UAE-${Date.now()}`,
        price: 1000,
        costPrice: 500,
        businessId: business.id 
      } 
    });
    
    // --- TEST CASE 1: Domestic Goods (Bill) ---
    const domesticBill = await billService.createBill(businessId, null, null, {
      billNumber: 'B-DOM-01',
      vendorId: domesticVendor.id,
      currencyCode: 'AED',
      items: [{ productId: goodsProduct.id, quantity: 1, price: 100, taxPercent: 5 }] // legacy taxPercent is ignored by backend
    });
    let txs = await prisma.taxTransaction.findMany({ where: { transactionId: domesticBill.id } });
    console.log("Case 1 (Domestic Goods):");
    console.dir(txs, { depth: null });

    // --- TEST CASE 2: Export Goods (Sales Invoice) ---
    // Actually, export is on the sales side. TransactionHelper handles INVOICE.
    const exportResult = await TransactionHelper.processTransactionFinancials({
        businessId,
        transactionDate: new Date(),
        currencyCode: 'AED',
        items: [{ productId: goodsProduct.id, quantity: 1, price: 100, taxPercent: 0 }],
        customerId: foreignCustomer.id,
        transactionType: 'INVOICE'
    });
    console.log("Case 2 (Export Goods) - Resolved Transactions:");
    console.dir(exportResult.taxTransactions, { depth: null });

    // --- TEST CASE 3: Domestic Services (Bill) ---
    const serviceBill = await billService.createBill(businessId, null, null, {
      billNumber: 'B-SVC-01',
      vendorId: domesticVendor.id,
      currencyCode: 'AED',
      items: [{ productId: servicesProduct.id, quantity: 1, price: 100, taxPercent: 5 }]
    });
    txs = await prisma.taxTransaction.findMany({ where: { transactionId: serviceBill.id } });
    console.log("Case 3 (Domestic Services):");
    console.dir(txs, { depth: null });

    // --- TEST CASE 4: Manual Override ---
    const overrideBill = await billService.createBill(businessId, "user-123", null, {
      billNumber: 'B-OVR-01',
      vendorId: domesticVendor.id,
      currencyCode: 'AED',
      items: [{ 
        productId: goodsProduct.id, 
        quantity: 1, 
        price: 100,
        isManualOverride: true, 
        overrideTaxRate: 0, 
        overrideReason: "UAE Exempt Status",
        overrideTaxTypeId: taxType.id 
      }]
    }, { roles: [{ role: { permissions: [{ permission: { name: 'TAX_OVERRIDE' } }] } }] });
    txs = await prisma.taxTransaction.findMany({ where: { transactionId: overrideBill.id } });
    console.log("Case 4 (Manual Override):");
    console.dir(txs, { depth: null });

    // --- TEST CASE 5: Non-override Debit Note ---
    // Raise Debit Note against Case 1 (Domestic Goods)
    const nonOverrideDn = await debitNoteService.createDebitNote(businessId, {
        debitNumber: 'DN-NOVR-01',
        billId: domesticBill.id,
        vendorId: domesticVendor.id,
        currencyCode: 'AED',
        items: [{ productId: goodsProduct.id, quantity: 1, price: 50, taxPercent: 5 }]
    }, null);
    txs = await prisma.taxTransaction.findMany({ where: { transactionId: nonOverrideDn.id } });
    console.log("Case 5 (Non-override Debit Note):");
    console.dir(txs, { depth: null });

    // --- TEST CASE 6: Override Debit Note ---
    // Let's rely on the backend automatically carrying forward the override fields based on the billId.
    const overrideDn = await debitNoteService.createDebitNote(businessId, {
        debitNumber: 'DN-OVR-01',
        billId: overrideBill.id,
        vendorId: domesticVendor.id,
        currencyCode: 'AED',
        items: [{ 
            productId: goodsProduct.id, 
            quantity: 1, 
            price: 50
        }]
    }, null);
    txs = await prisma.taxTransaction.findMany({ where: { transactionId: overrideDn.id } });
    console.log("Case 6 (Override Debit Note):");
    console.dir(txs, { depth: null });

    // --- TEST CASE 7: Reverse Charge (Import Services, Unregistered Vendor) ---
    // Bill from Foreign Unregistered Vendor for Services
    const rcBill = await billService.createBill(businessId, "test-user", null, {
        billNumber: 'RC-01',
        vendorId: foreignVendor.id,
        currencyCode: 'AED',
        items: [{ productId: servicesProduct.id, quantity: 1, price: 100, taxPercent: 5 }]
    });
    txs = await prisma.taxTransaction.findMany({ where: { transactionId: rcBill.id } });
    console.log("Case 7 (Reverse-Charge) TaxTransaction:");
    console.dir(txs, { depth: null });

    const matchedRate = await prisma.taxRate.findUnique({ where: { id: txs[0].taxRateId }});
    const matchedRule = await prisma.taxRule.findUnique({ where: { id: matchedRate.taxRuleId }});
    console.log("Case 7 Matched TaxRule:");
    console.dir(matchedRule, { depth: null });

  } catch (error) {
    console.error("Test Failed:", error);
  } finally { await prisma.$disconnect(); }
}

testUAETax();
