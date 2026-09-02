const prisma = require('./src/config/prisma');
const TaxResolver = require('./src/services/TaxResolver');
const TransactionHelper = require('./src/services/TransactionHelper');
const taxProvisioning = require('./src/services/taxProvisioning.service');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');

const TEST_COUNTRIES = [{ code: 'JP', fw: 'Japan Consumption Tax' }];

async function createTestData(businessId, countryCode) {
    const domesticVendor = await prisma.vendor.create({
      data: { businessId, name: 'Domestic Vendor', country: countryCode, state: 'DOMESTIC', taxNumber: "TAX-123" }
    });
    const foreignVendor = await prisma.vendor.create({
      data: { businessId, name: 'Foreign Vendor', country: 'US', state: 'NY' }
    });
    const domesticCustomer = await prisma.customer.create({
      data: { businessId, company: 'Domestic Corp', country: countryCode, state: 'DOMESTIC', region: 'INDIA' }
    });
    const foreignCustomer = await prisma.customer.create({
      data: { businessId, company: 'Foreign Corp', country: 'US', state: 'NY', region: 'CANADA' }
    });
    const goodsProduct = await prisma.product.create({
      data: { businessId, name: 'Goods Product', type: 'GOODS', price: 1000, sku: `G-${Date.now()}`, costPrice: 500 }
    });
    const servicesProduct = await prisma.product.create({
      data: { businessId, name: 'Services Product', type: 'SERVICE', price: 1000, sku: `S-${Date.now()}`, costPrice: 500 }
    });

    return { domesticVendor, foreignVendor, domesticCustomer, foreignCustomer, goodsProduct, servicesProduct };
}

async function runTests() {
  try {
    for (const c of TEST_COUNTRIES) {
        console.log(`\n======================================================`);
        console.log(`RUNNING TESTS FOR COUNTRY: ${c.code} (${c.fw})`);
        console.log(`======================================================`);
        
        let taxFramework = await prisma.taxFramework.findFirst({ where: { name: c.fw } });
        const country = await prisma.country.findFirst({ where: { code: c.code } });
        let usdCurrency = await prisma.currency.findFirst({ where: { code: 'USD' } });
        if (!country || !taxFramework || !usdCurrency) {
            console.log(`TaxFramework ${c.fw} or USD currency not found! Skipping.`);
            continue;
        }

        const business = await prisma.business.create({
            data: {
                name: `Test Business ${c.code} ` + Date.now(),
                taxFramework: { connect: { id: taxFramework.id } },
                countryCode: c.code,
                state: 'DOMESTIC',
                baseCurrency: { connect: { id: usdCurrency.id } },
                owner: {
                    create: {
                        name: "Test User",
                        email: `owner_${c.code}_${Date.now()}@test.com`,
                        password: "hash123",
                        role: "ADMIN"
                    }
                }
            }
        });

        const data = await createTestData(business.id, c.code);

        console.log(`\n--- 1. Provisioning Rules ---`);
        const provRes = await taxProvisioning.provisionTaxRules(business.id, c.code);
        console.log(`Provisioned ${provRes.created} rules.`);

        const seededRules = await prisma.taxRule.findMany({ where: { businessId: business.id }});
        console.log(`Seeded Rules for ${c.code}:`);
        for (const r of seededRules) {
            console.log(`  - ${r.name} (Rate: ${r.rate}%, Type: ${r.type}, Jurisdiction: ${r.jurisdiction || 'N/A'}, Category: ${r.taxCategory || 'N/A'})`);
        }

        console.log(`\n--- 2. Priority / Routing / Cross-Border Cases ---`);
        
        let standardRule = seededRules.find(r => r.taxCategory !== 'ZERO_RATED' && r.taxCategory !== 'EXEMPT' && r.taxCategory !== 'REVERSE_CHARGE' && r.rate > 0);
        let standardRate = standardRule ? standardRule.rate : 0;
        if (c.code === 'IN') standardRate = 18;

        const logTaxTransactions = async (label, txns) => {
            console.log(`${label} Resolved Tax Transactions:`);
            if (!txns || txns.length === 0) {
                console.log("  []");
                return;
            }
            const rateIds = txns.map(t => t.taxRateId).filter(Boolean);
            const rates = await prisma.taxRate.findMany({ where: { id: { in: rateIds } }, include: { taxType: true } });
            const map = Object.fromEntries(rates.map(r => [r.id, r]));
            const out = txns.map(t => ({
                rate: t.taxRateId ? map[t.taxRateId]?.rate : t.overrideRate,
                type: t.taxRateId ? map[t.taxRateId]?.taxType?.name : t.overrideTaxType?.name,
                taxableAmountBaseCcy: t.taxableAmountBaseCcy,
                taxAmountBaseCcy: t.taxAmountBaseCcy
            }));
            console.dir(out, { depth: null });
        };

        const caseA = await TransactionHelper.processTransactionFinancials({
            businessId: business.id,
            transactionId: `INV-DOM-${Date.now()}`,
            transactionDate: new Date(),
            currencyCode: 'USD',
            items: [{ productId: data.goodsProduct.id, quantity: 1, price: 100, taxPercent: standardRate }],
            customerId: data.domesticCustomer.id,
            transactionType: 'INVOICE'
        });
        await TransactionHelper.saveTaxLedger(prisma, business.id, 'INVOICE', caseA.taxTransactions[0]?.transactionId || 'INV', caseA.taxTransactions);
        await logTaxTransactions(`Case A (Domestic Goods):`, caseA.taxTransactions);

        const caseB = await TransactionHelper.processTransactionFinancials({
            businessId: business.id,
            transactionId: `INV-EXP-${Date.now()}`,
            transactionDate: new Date(),
            currencyCode: 'USD',
            items: [{ productId: data.goodsProduct.id, quantity: 1, price: 100, taxPercent: 0, taxCategory: 'ZERO_RATED' }],
            customerId: data.foreignCustomer.id,
            transactionType: 'INVOICE'
        });
        await TransactionHelper.saveTaxLedger(prisma, business.id, 'INVOICE', caseB.taxTransactions[0]?.transactionId || 'INV', caseB.taxTransactions);
        await logTaxTransactions(`Case B (Export Goods):`, caseB.taxTransactions);

        if (c.code === 'AU') {
            console.log(`\nCase C (Domestic Services Reverse Charge): Skipped for AU (no broad domestic reverse charge exists)`);
        } else if (c.code === 'SG' || c.code === 'SA' || c.code === 'JP') {
            const label = c.code === 'SG' ? 'SG' : (c.code === 'SA' ? 'SA' : 'JP');
            let note = '';
            if (c.code === 'SG') note = 'SG reverse charge applies to IMPORTED services from overseas non-GST-registered suppliers (not domestic vendors).';
            else if (c.code === 'SA') note = 'SA reverse charge applies to imported services from non-SA-registered foreign suppliers (ZATCA VAT law). Not a broad domestic mechanism.';
            else if (c.code === 'JP') note = 'JP reverse charge applies to cross-border B2B digital services provided by foreign businesses (since 2015). Not a broad domestic mechanism.';
            
            console.log(`\nCase C (Imported Services Reverse Charge — ${label}): NOTE — ${note} Test harness uses domesticVendor; routing test is engine-only validation.`);
            const caseC = await TransactionHelper.processTransactionFinancials({
                businessId: business.id,
                transactionId: `BILL-SVC-${Date.now()}`,
                transactionDate: new Date(),
                currencyCode: 'USD',
                items: [{ productId: data.servicesProduct.id, quantity: 1, price: 100, taxPercent: 5, taxCategory: 'REVERSE_CHARGE' }],
                vendorId: data.domesticVendor.id,
                transactionType: 'BILL'
            });
            await TransactionHelper.saveTaxLedger(prisma, business.id, 'BILL', caseC.taxTransactions[0]?.transactionId || 'BILL', caseC.taxTransactions);
            await logTaxTransactions(`Case C (${label} Imported Services RC — engine routing only):`, caseC.taxTransactions);
        } else {
            const caseC = await TransactionHelper.processTransactionFinancials({
                businessId: business.id,
                transactionId: `BILL-SVC-${Date.now()}`,
                transactionDate: new Date(),
                currencyCode: 'USD',
                items: [{ productId: data.servicesProduct.id, quantity: 1, price: 100, taxPercent: 5, taxCategory: 'REVERSE_CHARGE' }],
                vendorId: data.domesticVendor.id,
                transactionType: 'BILL'
            });
            await TransactionHelper.saveTaxLedger(prisma, business.id, 'BILL', caseC.taxTransactions[0]?.transactionId || 'BILL', caseC.taxTransactions);
            await logTaxTransactions(`Case C (Domestic Services Reverse Charge):`, caseC.taxTransactions);
        }

        console.log(`\n--- 3. Statutory Report Run ---`);
        const reportsList = statutoryRegistry.getAvailableReports(c.fw);
        if (reportsList.length > 0) {
            console.log(`Available Reports: ${reportsList.map(r => r.name).join(', ')}`);
            for (const rep of reportsList) {
                const reportRes = await statutoryRegistry.generateReport(c.fw, rep.code, business.id, {});
                console.log(`\nReport Output for [${rep.name}]:`);
                console.log(JSON.stringify(reportRes, null, 2));
            }
        } else {
            console.log(`No statutory reports configured for ${c.fw}.`);
        }
    }
  } catch (error) {
    console.error("Test Failed:", error);
  } finally { 
    await prisma.$disconnect(); 
  }
}

runTests();
