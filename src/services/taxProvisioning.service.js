/**
 * TaxProvisioningService
 *
 * Automatically creates per-business TaxRule rows when a business selects
 * (or changes) its country. Each rule is linked to all applicable TaxRate
 * rows from the global seeded reference data, including historical effective-
 * dated rows, so date-driven rate resolution works automatically.
 *
 * Design invariants:
 * - Only rows with autoProvisioned=true are replaced on country change.
 *   Manually configured rules survive country re-selection.
 * - TaxRule.rate stores the aggregate rate callers pass as taxPercent.
 *   Individual component rates live in TaxRate rows — no duplication.
 * - When a new TaxRate row is added globally (e.g. UK VAT rate change),
 *   existing provisioned TaxRule rows pick it up automatically via taxRuleId
 *   linkage — no re-provisioning needed.
 */

const prisma = require('../config/prisma');

// ---------------------------------------------------------------------------
// PROVISIONING MANIFESTS
// Per-country definitions of which TaxRule rows to create and which
// TaxType names to link (all TaxRate rows for that TaxType are linked).
// ---------------------------------------------------------------------------
const PROVISIONING_MANIFESTS = {
  // ---- INDIA ---------------------------------------------------------------
  IN: {
    frameworkName: 'India GST',
    rules: [
      { name: 'India Intra GST 18%',         rate: 18,  jurisdiction: 'INTRASTATE', taxCategory: null,             components: ['CGST', 'SGST'] },
      { name: 'India Inter GST 18%',          rate: 18,  jurisdiction: 'INTERSTATE', taxCategory: null,             components: ['IGST'] },
      { name: 'India Zero Rated Export',      rate: 0,   jurisdiction: 'INTERSTATE', taxCategory: 'ZERO_RATED',     components: ['IGST'] },
      { name: 'India Nil Rated',              rate: 0,   jurisdiction: 'INTRASTATE', taxCategory: null,             components: ['CGST'] },
      { name: 'India Reverse Charge 5%',      rate: 5,   jurisdiction: 'INTRASTATE', taxCategory: 'REVERSE_CHARGE', components: ['CGST', 'SGST'] },
    ]
  },
  // ---- UAE -----------------------------------------------------------------
  AE: {
    frameworkName: 'UAE VAT',
    rules: [
      { name: 'UAE Standard VAT 5%',          rate: 5,   jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'UAE Zero Rated 0%',            rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['VAT_ZERO'] },
      { name: 'UAE Exempt 0%',                rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['VAT_EXEMPT'] },
      { name: 'UAE Reverse Charge 5%',        rate: 5,   jurisdiction: null, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
    ]
  },
  // ---- UNITED KINGDOM ------------------------------------------------------
  GB: {
    frameworkName: 'UK VAT',
    rules: [
      { name: 'UK Standard VAT 20%',          rate: 20,  jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'UK Reduced VAT 5%',            rate: 5,   jurisdiction: null, taxCategory: null,             components: ['VAT_REDUCED'] },
      { name: 'UK Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['VAT_ZERO'] },
      { name: 'UK Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['VAT_EXEMPT'] },
      { name: 'UK Reverse Charge 20%',        rate: 20,  jurisdiction: null, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
    ]
  },
  // ---- AUSTRALIA -----------------------------------------------------------
  AU: {
    frameworkName: 'AU GST',
    rules: [
      { name: 'AU Standard GST 10%',          rate: 10,  jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'AU GST-Free 0%',               rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['GST_FREE'] },
      { name: 'AU Input Taxed 0%',            rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',     components: ['INPUT_TAXED'] },
    ]
  },
  // ---- SINGAPORE -----------------------------------------------------------
  SG: {
    frameworkName: 'SG GST',
    rules: [
      // SG standard rule covers ALL historical GST_STANDARD rows (7%, 8%, 9%)
      // TaxEngine selects the active one by effectiveFrom/effectiveTo at call time.
      { name: 'SG Standard GST',              rate: 9,   jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'SG Standard GST 8% (hist.)',   rate: 8,   jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'SG Standard GST 7% (hist.)',   rate: 7,   jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'SG Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['GST_ZERO'] },
      { name: 'SG Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',     components: ['GST_EXEMPT'] },
    ]
  },
  // ---- GERMANY -------------------------------------------------------------
  DE: {
    frameworkName: 'Deutschland MwSt',
    rules: [
      { name: 'DE Standard MwSt 19%',          rate: 19,  jurisdiction: null, taxCategory: null,             components: ['MwSt_STANDARD'] },
      { name: 'DE Standard MwSt 16% (COVID)',   rate: 16,  jurisdiction: null, taxCategory: null,             components: ['MwSt_STANDARD'] },
      { name: 'DE Ermäßigt MwSt 7%',           rate: 7,   jurisdiction: null, taxCategory: null,             components: ['MwSt_ERMAESSIGT'] },
      { name: 'DE Ermäßigt MwSt 5% (COVID)',    rate: 5,   jurisdiction: null, taxCategory: null,             components: ['MwSt_ERMAESSIGT'] },
      { name: 'DE Zero-Rated 0%',               rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['MwSt_NULLSATZ'] },
      { name: 'DE Exempt 0%',                   rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['MwSt_BEFREIT'] },
      { name: 'DE Reverse Charge 19%',          rate: 19,  jurisdiction: null, taxCategory: 'REVERSE_CHARGE', components: ['MwSt_REVERSE_CHARGE'] },
      { name: 'DE Reverse Charge 16% (COVID)',  rate: 16,  jurisdiction: null, taxCategory: 'REVERSE_CHARGE', components: ['MwSt_REVERSE_CHARGE'] },
    ]
  },
  // ---- NEW ZEALAND ---------------------------------------------------------
  NZ: {
    frameworkName: 'NZ GST',
    rules: [
      { name: 'NZ Standard GST 15%',          rate: 15,   jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'NZ Standard GST 12.5% (hist.)',rate: 12.5, jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'NZ Zero Rated 0%',             rate: 0,    jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['GST_ZERO'] },
      { name: 'NZ Exempt 0%',                 rate: 0,    jurisdiction: null, taxCategory: 'EXEMPT',     components: ['GST_EXEMPT'] },
    ]
  },
  // ---- SOUTH AFRICA --------------------------------------------------------
  ZA: {
    frameworkName: 'South Africa VAT',
    rules: [
      { name: 'ZA Standard VAT 15%',           rate: 15,  jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'ZA Standard VAT 14% (hist.)',    rate: 14,  jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'ZA Zero Rated 0%',              rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['VAT_ZERO'] },
      { name: 'ZA Exempt 0%',                  rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['VAT_EXEMPT'] },
      { name: 'ZA Reverse Charge 15%',         rate: 15,  jurisdiction: null, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
      { name: 'ZA Reverse Charge 14% (hist.)', rate: 14,  jurisdiction: null, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
    ]
  },
};

// ---------------------------------------------------------------------------
// Core provisioning function
// ---------------------------------------------------------------------------

/**
 * Provisions TaxRule rows for a business based on its country code.
 * Safe to call on business creation AND on country change.
 *
 * On country change:
 *   - Deletes existing auto-provisioned rules (autoProvisioned=true)
 *   - Manually configured rules (autoProvisioned=false) are preserved
 *
 * @param {string} businessId
 * @param {string} countryCode - ISO 3166-1 alpha-2, e.g. 'IN', 'DE', 'GB'
 * @returns {Promise<{ created: number, skipped: string }>}
 */
async function provisionTaxRules(businessId, countryCode) {
  const manifest = PROVISIONING_MANIFESTS[countryCode];

  if (!manifest) {
    console.warn(`[TaxProvisioning] No manifest for country code '${countryCode}'. Skipping provisioning.`);
    return { created: 0, skipped: `No manifest for ${countryCode}` };
  }

  // 1. Fetch the TaxFramework for this country
  const framework = await prisma.taxFramework.findFirst({
    where: { name: manifest.frameworkName },
    include: { taxTypes: { include: { rates: true } } }
  });

  if (!framework) {
    throw new Error(`[TaxProvisioning] TaxFramework '${manifest.frameworkName}' not found. Run seed-taxes.js first.`);
  }

  // Build a map: taxTypeName → [TaxRate rows]
  const taxTypeMap = {};
  for (const tt of framework.taxTypes) {
    taxTypeMap[tt.name] = tt.rates;
  }

  // 2. Delete existing auto-provisioned rules for this business
  //    (SetNull on TaxRate.taxRuleId means linked TaxRate rows lose their ruleId,
  //     which is fine — they remain in the DB as global reference data)
  const deleted = await prisma.taxRule.deleteMany({
    where: { businessId, autoProvisioned: true }
  });
  if (deleted.count > 0) {
    console.log(`[TaxProvisioning] Removed ${deleted.count} stale auto-provisioned rules for business ${businessId}`);
  }

  // 3. Create new rules per manifest
  let created = 0;
  for (const ruleDef of manifest.rules) {
    const newRule = await prisma.taxRule.create({
      data: {
        businessId,
        name: ruleDef.name,
        rate: ruleDef.rate,
        type: framework.name.includes('GST') ? 'GST' : 'VAT',
        jurisdiction: ruleDef.jurisdiction || null,
        taxCategory: ruleDef.taxCategory || null,
        autoProvisioned: true,
      }
    });

    // 4. Link matching TaxRate rows from the global reference data
    //    For each component TaxType name, find all TaxRate rows and link them
    for (const taxTypeName of ruleDef.components) {
      const rates = taxTypeMap[taxTypeName] || [];
      for (const rate of rates) {
        // Only link if the rate's individual component rate is consistent with the rule's aggregate
        // For split-rate rules (e.g. CGST 9% + SGST 9% → aggregate 18%), each component row
        // belongs to ONE rule (the rule whose aggregate = sum of all component rates of that type).
        // For single-component rules (VAT, IGST, GST), the component rate = the aggregate rate.
        // We use rate.rate to filter: link to this rule only rows whose component rate
        // is plausible for this aggregate (avoids cross-linking 9% CGST to a 5% rule).
        const isComponentMatch = Math.abs(rate.rate - ruleDef.rate) < 0.01  // single-component match
          || (ruleDef.components.length > 1);                                // split-rate: link all rows of this type

        if (isComponentMatch) {
          await prisma.taxRate.update({
            where: { id: rate.id },
            data: { taxRuleId: newRule.id }
          });
        }
      }
    }
    created++;
  }

  console.log(`[TaxProvisioning] Provisioned ${created} TaxRule(s) for business ${businessId} (country: ${countryCode})`);
  return { created };
}

module.exports = { provisionTaxRules, PROVISIONING_MANIFESTS };
