/**
 * test-de-no-taxrule.js
 *
 * Confirms the gap: a brand new German business with country=DE,
 * taxFrameworkId set to Deutschland MwSt, but NO manually created TaxRule
 * throws RateResolutionError on its first invoice — proving country selection
 * alone is NOT sufficient without auto-provisioning.
 */
const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');

async function run() {
  try {
    const de = await prisma.country.findUnique({ where: { code: 'DE' } });
    const eur = await prisma.currency.findUnique({ where: { code: 'EUR' } });
    const deFw = await prisma.taxFramework.findFirst({ where: { name: 'Deutschland MwSt' } });
    const user = await prisma.user.findFirst();

    // Create a German business with correct country + taxFramework — but NO TaxRule
    const biz = await prisma.business.create({
      data: {
        name: 'DE No-TaxRule Biz',
        baseCurrencyId: eur.id,
        countryId: de.id,
        ownerId: user.id,
        taxFrameworkId: deFw.id   // framework is set correctly
      }
    });

    // Confirm no TaxRules exist for this business
    const rules = await prisma.taxRule.findMany({ where: { businessId: biz.id } });
    console.log(`TaxRules for new DE business: ${rules.length} (expected 0)`);

    // Now try to create an invoice with 19% MwSt — exactly what a real onboarding would do
    try {
      await TaxEngine.calculateTax({
        businessId: biz.id,
        lineSubtotal: 1000,
        taxPercent: 19,
        transactionDate: new Date()
      });
      console.log('RESULT: Tax calculated successfully — auto-provisioning exists (unexpected)');
    } catch (err) {
      console.log(`RESULT: Throws → "${err.message}"`);
      console.log('\nCONCLUSION: Country selection alone is NOT sufficient.');
      console.log('Seed data (TaxType/TaxRate) is in the DB, but no TaxRule was auto-created for this business.');
      console.log('A German business will throw RateResolutionError on its first invoice without manual TaxRule setup.');
    }
  } catch (err) {
    console.error('Setup error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
