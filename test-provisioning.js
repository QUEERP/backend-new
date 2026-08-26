/**
 * test-provisioning.js
 *
 * End-to-end verification of TaxProvisioningService.
 *
 * Tests:
 * 1. New India business: INTRASTATE and INTERSTATE rules auto-created, TaxEngine works
 * 2. New Germany business: 19%/16%/7%/5% rules auto-created, Aug 2020 → 16% COVID rate
 * 3. Country change (India → Germany): stale India rules deleted, DE rules created, manual rule preserved
 */

const prisma = require('./src/config/prisma');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');
const TaxEngine = require('./src/services/taxEngine');
const crypto = require('crypto');

async function run() {
  let passed = 0; let failed = 0;

  const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`  ${ok ? 'PASS ✓' : 'FAIL ✗'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    ok ? passed++ : failed++;
  };

  try {
    const user = await prisma.user.findFirst();
    const inr = await prisma.currency.findUnique({ where: { code: 'INR' } });
    const eur = await prisma.currency.upsert({ where: { code: 'EUR' }, update: {}, create: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 } });
    const india = await prisma.country.findUnique({ where: { code: 'IN' } });
    const germany = await prisma.country.findUnique({ where: { code: 'DE' } });
    const inFw = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
    const deFw = await prisma.taxFramework.findFirst({ where: { name: 'Deutschland MwSt' } });

    // =========================================================================
    // TEST 1: India business — auto-provisioned from scratch
    // =========================================================================
    console.log('\n=== TEST 1: India auto-provisioning ===');

    const indiaBiz = await prisma.business.create({
      data: { name: 'Prov Test India', baseCurrencyId: inr.id, countryId: india.id, ownerId: user.id, taxFrameworkId: inFw.id }
    });

    await provisionTaxRules(indiaBiz.id, 'IN');

    const indiaRules = await prisma.taxRule.findMany({
      where: { businessId: indiaBiz.id },
      orderBy: { name: 'asc' }
    });
    console.log(`  Created ${indiaRules.length} rules:`);
    indiaRules.forEach(r => console.log(`    - ${r.name} (rate=${r.rate}, jur=${r.jurisdiction}, cat=${r.taxCategory}, auto=${r.autoProvisioned})`));

    const intraRule = indiaRules.find(r => r.jurisdiction === 'INTRASTATE' && r.rate === 18);
    const interRule = indiaRules.find(r => r.jurisdiction === 'INTERSTATE' && r.rate === 18);
    check('INTRASTATE 18% rule exists', !!intraRule, true);
    check('INTERSTATE 18% rule exists', !!interRule, true);
    check('All rules are autoProvisioned', indiaRules.every(r => r.autoProvisioned), true);

    // Verify TaxEngine works for intra-state (CGST 9% + SGST 9%)
    const intraTxns = await TaxEngine.calculateTax({
      businessId: indiaBiz.id,
      businessState: 'Maharashtra',
      customerState: 'Maharashtra',
      lineSubtotal: 1000,
      taxPercent: 18
    });
    check('India INTRASTATE tax count (CGST+SGST = 2 rows)', intraTxns.length, 2);
    const totalTax = intraTxns.reduce((s, t) => s + t.taxAmountTxnCcy, 0);
    check('India INTRASTATE total tax (1000 × 18%)', totalTax, 180);

    // =========================================================================
    // TEST 2: Germany business — COVID rate + regular rates
    // =========================================================================
    console.log('\n=== TEST 2: Germany auto-provisioning (COVID rates) ===');

    const deBiz = await prisma.business.create({
      data: { name: 'Prov Test Germany', baseCurrencyId: eur.id, countryId: germany.id, ownerId: user.id, taxFrameworkId: deFw.id }
    });

    await provisionTaxRules(deBiz.id, 'DE');

    const deRules = await prisma.taxRule.findMany({ where: { businessId: deBiz.id }, orderBy: { rate: 'asc' } });
    console.log(`  Created ${deRules.length} rules:`);
    deRules.forEach(r => console.log(`    - ${r.name} (rate=${r.rate}, cat=${r.taxCategory})`));

    check('COVID 16% rule exists', !!deRules.find(r => r.rate === 16 && !r.taxCategory), true);
    check('Standard 19% rule exists', !!deRules.find(r => r.rate === 19 && !r.taxCategory), true);
    check('Reduced 7% rule exists', !!deRules.find(r => r.rate === 7), true);
    check('COVID reduced 5% rule exists', !!deRules.find(r => r.rate === 5 && !r.taxCategory), true);

    // COVID rate test: Aug 2020 → must resolve to 16%
    const covidTxns = await TaxEngine.calculateTax({
      businessId: deBiz.id,
      lineSubtotal: 1000,
      taxPercent: 16,
      transactionDate: new Date('2020-08-15')
    });
    check('DE Aug 2020 COVID taxAmount (1000×16%=160)', covidTxns[0]?.taxAmountTxnCcy, 160);

    // Post-COVID: 2021 → must resolve to 19%
    const postCovidTxns = await TaxEngine.calculateTax({
      businessId: deBiz.id,
      lineSubtotal: 1000,
      taxPercent: 19,
      transactionDate: new Date('2021-06-01')
    });
    check('DE Jun 2021 taxAmount (1000×19%=190)', postCovidTxns[0]?.taxAmountTxnCcy, 190);

    // =========================================================================
    // TEST 3: Country change — India → Germany
    // =========================================================================
    console.log('\n=== TEST 3: Country change (India → Germany) ===');

    // Seed a manual (non-auto) rule to prove it survives re-provisioning
    const manualRule = await prisma.taxRule.create({
      data: { businessId: indiaBiz.id, name: 'Custom Manual Rule', rate: 2, type: 'CESS', autoProvisioned: false }
    });

    const beforeChange = await prisma.taxRule.count({ where: { businessId: indiaBiz.id } });
    console.log(`  Before country change: ${beforeChange} rules`);

    // Re-provision for Germany (simulating country change)
    await prisma.business.update({
      where: { id: indiaBiz.id },
      data: { countryId: germany.id, taxFrameworkId: deFw.id }
    });
    await provisionTaxRules(indiaBiz.id, 'DE');

    const afterRules = await prisma.taxRule.findMany({ where: { businessId: indiaBiz.id }, orderBy: { name: 'asc' } });
    console.log(`  After country change: ${afterRules.length} rules`);
    afterRules.forEach(r => console.log(`    - ${r.name} (auto=${r.autoProvisioned})`));

    const manualSurvived = afterRules.some(r => r.id === manualRule.id);
    const oldIndiaRulesGone = !afterRules.some(r => r.name.includes('India') && r.autoProvisioned);
    const newDeRulesExist = afterRules.some(r => r.name.includes('DE') && r.autoProvisioned);
    check('Manual rule survived country change', manualSurvived, true);
    check('Old India auto-rules removed', oldIndiaRulesGone, true);
    check('New DE auto-rules created', newDeRulesExist, true);

  } catch (err) {
    console.error('\nUnexpected error:', err.message);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  }
}

run();
