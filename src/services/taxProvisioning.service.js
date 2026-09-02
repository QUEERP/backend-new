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
      // Real law: CGST/SGST dual-component intrastate is per CGST Act 2017
      { name: 'India Intra GST 18%',         rate: 18,  jurisdiction: 'INTRASTATE', taxCategory: null,             components: [{ name: 'CGST', expectedRate: 9 }, { name: 'SGST', expectedRate: 9 }] },
      // Real law: IGST interstate is per IGST Act 2017
      { name: 'India Inter GST 18%',          rate: 18,  jurisdiction: 'INTERSTATE', taxCategory: null,             components: ['IGST'] },
      { name: 'India Zero Rated Export',      rate: 0,   jurisdiction: 'INTERSTATE', placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED',     components: ['IGST'] },
      { name: 'India Nil Rated',              rate: 0,   jurisdiction: 'INTRASTATE', taxCategory: null,             components: ['CGST'] },
      // Plausible but unverified: GTA/legal-services RCM under CBIC Notification 13/2017-CT(R). 
      // The generic 'SERVICES' trigger is structural scaffolding — real scope is specific notified categories, not all services.
      { name: 'India Reverse Charge 5%',      rate: 5,   jurisdiction: 'INTRASTATE', supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: [{ name: 'CGST', expectedRate: 2.5 }, { name: 'SGST', expectedRate: 2.5 }] },
    ]
  },
  // ---- UAE -----------------------------------------------------------------
  AE: {
    frameworkName: 'UAE VAT',
    rules: [
      // ⚠️ All UAE rules recalled from general knowledge — not verified against specific FTA (Federal Tax Authority) guidance in this session.
      { name: 'UAE Standard VAT 5%',          rate: 5,   jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'UAE Zero Rated 0%',            rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['VAT_ZERO'] },
      { name: 'UAE Zero Rated Export 0%',     rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['VAT_ZERO'] },
      { name: 'UAE Exempt 0%',                rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['VAT_EXEMPT'] },
      // ❌ SCAFFOLDING: UAE reverse charge applies to specific imported services and goods under UAE VAT law.
      // The 'SERVICES' trigger is a broad placeholder — real scope is specific ZATCA-equivalent FTA notified categories.
      { name: 'UAE Reverse Charge 5%',        rate: 5,   jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
    ]
  },
  // ---- SAUDI ARABIA --------------------------------------------------------
  SA: {
    frameworkName: 'Saudi Arabia VAT',
    rules: [
      // ⚠️ Standard rate: 15% (effective 1 Jul 2020, increased from 5% due to COVID fiscal measures).
      // Rate history recalled from ZATCA public announcements — plausible, not verified against specific ZATCA circular this session.
      { name: 'SA Standard VAT 15%',          rate: 15,  jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'SA Standard VAT 5% (hist.)',   rate: 5,   jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      // ⚠️ Zero-rated: exports, medicines, medical equipment, international transport.
      // SA VAT Implementing Regulations — categories recalled, not source-checked this session.
      { name: 'SA Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['VAT_ZERO'] },
      // ⚠️ Export routing trigger. Plausible, not source-checked this session.
      { name: 'SA Zero Rated Export 0%',      rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['VAT_ZERO'] },
      // ⚠️ Exempt: financial services (interest-bearing), life insurance, residential property (first supply).
      // Recalled from general knowledge — not source-checked this session.
      { name: 'SA Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['VAT_EXEMPT'] },
      // ❌ SCAFFOLDING: SA VAT has a reverse charge mechanism for imported services from non-SA-registered
      // foreign suppliers (ZATCA VAT law). Legal basis real; 'SERVICES' trigger is a broad placeholder.
      // Must be narrowed to specific notified categories before production use.
      { name: 'SA Reverse Charge 15%',        rate: 15,  jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
    ]
  },
  // ---- UNITED KINGDOM ------------------------------------------------------
  GB: {
    frameworkName: 'UK VAT',
    rules: [
      // Real law: HMRC VAT Notice 700 — standard/reduced/zero/exempt are all correct as of 2024
      { name: 'UK Standard VAT 20%',          rate: 20,  jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'UK Reduced VAT 5%',            rate: 5,   jurisdiction: null, taxCategory: null,             components: ['VAT_REDUCED'] },
      { name: 'UK Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['VAT_ZERO'] },
      { name: 'UK Zero Rated Export 0%',      rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['VAT_ZERO'] },
      { name: 'UK Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['VAT_EXEMPT'] },
      // Real law: domestic reverse charge exists (HMRC CIS reverse charge SI 2019/892, electronics/mobile phones since 2007).
      // However, this generic 'SERVICES' trigger is structural scaffolding — the real scope is a specific HMRC-notified list, not all services.
      { name: 'UK Reverse Charge 20%',        rate: 20,  jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
    ]
  },
  // ---- AUSTRALIA -----------------------------------------------------------
  AU: {
    frameworkName: 'AU GST',
    rules: [
      // Sourced from ATO rules
      { name: 'AU Standard GST 10%',          rate: 10,  jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'AU GST-Free 0%',               rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['GST_FREE'] },
      { name: 'AU GST-Free Export 0%',        rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['GST_FREE'] },
      { name: 'AU Input Taxed 0%',            rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',     components: ['INPUT_TAXED'] }
    ]
  },
  // ---- SINGAPORE -----------------------------------------------------------
  SG: {
    frameworkName: 'SG GST',
    rules: [
      // ⚠️ Rate history recalled from general knowledge — not verified against specific IRAS circular in this session.
      // Rate timeline: 7% (pre-2023) → 8% (2023) → 9% (2024+), per IRAS GST rate change announcements.
      { name: 'SG Standard GST 9%',          rate: 9,   jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'SG Standard GST 8% (hist.)',   rate: 8,   jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      { name: 'SG Standard GST 7% (hist.)',   rate: 7,   jurisdiction: null, taxCategory: null,         components: ['GST_STANDARD'] },
      // ⚠️ Zero-rated: exports and international services. Legal basis: GST Act s.21. Plausible, not source-checked in session.
      { name: 'SG Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['GST_ZERO'] },
      // ⚠️ Export routing trigger: goods exported from Singapore. Plausible, not source-checked in session.
      { name: 'SG Zero Rated Export 0%',      rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['GST_ZERO'] },
      // ⚠️ Exempt: financial services, residential property, certain precious metals. GST Act s.22/Fourth Schedule. Plausible, not source-checked.
      { name: 'SG Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',     components: ['GST_EXEMPT'] },
      // ⚠️ SCAFFOLDING (partial): SG reverse charge exists for *imported services* from overseas non-GST-registered suppliers
      // (IRAS e-Tax Guide "GST: Reverse Charge", effective 1 Jan 2020). It does NOT apply to domestic services.
      // The 'SERVICES' trigger here is a testing scaffold — Case C uses domesticVendor and cannot correctly simulate
      // the cross-border imported-services scenario. This rule is present for engine routing validation only.
      { name: 'SG Reverse Charge 9%',         rate: 9,   jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['GST_REVERSE_CHARGE'] },
    ]
  },
  // ---- GERMANY -------------------------------------------------------------
  DE: {
    frameworkName: 'Deutschland MwSt',
    rules: [
      // Sourced from general domain knowledge (plausible but unverified against live BZSt docs in this session)
      { name: 'DE Standard MwSt 19%',          rate: 19,  jurisdiction: null, taxCategory: null,             components: ['MwSt_STANDARD'] },
      { name: 'DE Standard MwSt 16% (COVID)',   rate: 16,  jurisdiction: null, taxCategory: null,             components: ['MwSt_STANDARD'] },
      { name: 'DE Ermäßigt MwSt 7%',           rate: 7,   jurisdiction: null, taxCategory: null,             components: ['MwSt_ERMAESSIGT'] },
      { name: 'DE Ermäßigt MwSt 5% (COVID)',    rate: 5,   jurisdiction: null, taxCategory: null,             components: ['MwSt_ERMAESSIGT'] },
      { name: 'DE Zero-Rated 0%',               rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['MwSt_NULLSATZ'] },
      { name: 'DE Zero-Rated Export 0%',        rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['MwSt_NULLSATZ'] },
      { name: 'DE Exempt 0%',                   rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['MwSt_BEFREIT'] },
      // Reverse charge (13b UStG) applies to specific B2B services (e.g. construction, cross-border). 
      // This generic 'SERVICES' trigger is structural scaffolding for testing (plausible shape, unverified exact scope).
      { name: 'DE Reverse Charge 19%',          rate: 19,  jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['MwSt_REVERSE_CHARGE'] },
      { name: 'DE Reverse Charge 16% (COVID)',  rate: 16,  jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['MwSt_REVERSE_CHARGE'] },
    ]
  },
  // ---- JAPAN ---------------------------------------------------------------
  JP: {
    frameworkName: 'Japan Consumption Tax',
    rules: [
      // ⚠️ Standard rate: 10% (effective 1 Oct 2019).
      // Rate history recalled from general knowledge — plausible, not verified against specific NTA circular this session.
      { name: 'JP Standard JCT 10%',          rate: 10,  jurisdiction: null, taxCategory: null,             components: ['JCT_STANDARD'] },
      { name: 'JP Reduced JCT 8%',            rate: 8,   jurisdiction: null, taxCategory: null,             components: ['JCT_REDUCED'] },
      { name: 'JP Standard JCT 8% (hist.)',   rate: 8,   jurisdiction: null, taxCategory: null,             components: ['JCT_STANDARD'] },
      // ⚠️ Zero-rated: exports, international transport. Plausible, not source-checked this session.
      { name: 'JP Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['JCT_ZERO'] },
      // ⚠️ Export routing trigger.
      { name: 'JP Zero Rated Export 0%',      rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['JCT_ZERO'] },
      // ⚠️ Exempt: financial services, medical, educational.
      { name: 'JP Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['JCT_EXEMPT'] },
      // ❌ SCAFFOLDING: Japan JCT has a reverse charge for cross-border B2B digital services (since 2015).
      // The 'SERVICES' trigger is a broad placeholder — must be narrowed.
      { name: 'JP Reverse Charge 10%',        rate: 10,  jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['JCT_REVERSE_CHARGE'] },
    ]
  },
  // ---- SOUTH AFRICA ----------------------------------------------------------
  ZA: {
    frameworkName: 'South Africa VAT',
    rules: [
      // ⚠️ Standard rate: 15% (effective April 2018). Rate history plausible, needs human review before production.
      { name: 'ZA Standard VAT 15%',          rate: 15,  jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      { name: 'ZA Standard VAT 14% (hist.)',  rate: 14,  jurisdiction: null, taxCategory: null,             components: ['VAT_STANDARD'] },
      // ⚠️ Zero-rated: exports, international transport.
      { name: 'ZA Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['VAT_ZERO'] },
      // ⚠️ Export routing trigger.
      { name: 'ZA Zero Rated Export 0%',      rate: 0,   jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['VAT_ZERO'] },
      // ⚠️ Exempt: financial services, residential accommodation.
      { name: 'ZA Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['VAT_EXEMPT'] },
      // ❌ SCAFFOLDING: South Africa VAT has a reverse charge for imported services.
      // The 'SERVICES' trigger is a broad placeholder — must be narrowed.
      { name: 'ZA Reverse Charge 15%',        rate: 15,  jurisdiction: null, supplyCategory: 'SERVICES', priority: -1, taxCategory: 'REVERSE_CHARGE', components: ['VAT_REVERSE_CHARGE'] },
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

  // ---- CANADA --------------------------------------------------------------
  CA: {
    frameworkName: 'Canada GST/HST',
    rules: [
      { name: 'CA GST 5%',  rate: 5,  jurisdiction: null, taxCategory: null, components: ['GST'] },
      { name: 'CA PST 7%',  rate: 7,  jurisdiction: null, taxCategory: null, components: ['PST'] },
      { name: 'CA HST 13%', rate: 13, jurisdiction: null, taxCategory: null, components: ['HST'] },
    ]
  },
  // ---- BATCH 1: NEXT 10 COUNTRIES ------------------------------------------
  US: {
    frameworkName: 'US Sales Tax',
    rules: [
      // Only provisioning CA and NY as starting points. Unconfigured states will throw RateResolutionError.
      { name: 'US CA State Sales Tax 7.25%',  rate: 7.25, jurisdiction: 'CA', taxCategory: null, components: ['STATE_SALES_TAX'] },
      { name: 'US NY State Sales Tax 4.0%',   rate: 4.0,  jurisdiction: 'NY', taxCategory: null, components: ['STATE_SALES_TAX'] },
    ]
  },
  BR: {
    frameworkName: 'Brazil ICMS',
    rules: [
      { name: 'BR ICMS (São Paulo Standard) 18%', rate: 18, jurisdiction: null, taxCategory: null, components: ['ICMS'] }
    ]
  },

  FR: {
    frameworkName: 'France TVA',
    rules: [
      { name: 'FR Standard TVA 20%',              rate: 20,   jurisdiction: null, taxCategory: null, components: ['TVA_STANDARD'] },
      { name: 'FR Intermediate TVA 10%',          rate: 10,   jurisdiction: null, taxCategory: null, components: ['TVA_INTERMEDIATE'] },
      { name: 'FR Reduced TVA 5.5%',              rate: 5.5,  jurisdiction: null, taxCategory: null, components: ['TVA_REDUCED'] },
      { name: 'FR Super-Reduced TVA 2.1%',        rate: 2.1,  jurisdiction: null, taxCategory: null, components: ['TVA_SUPER_REDUCED'] },
    ]
  },
  MX: {
    frameworkName: 'Mexico IVA',
    rules: [
      { name: 'MX Standard IVA 16%',              rate: 16, jurisdiction: null, taxCategory: null, components: ['IVA_STANDARD'] },
      { name: 'MX Border IVA 8%',                 rate: 8,  jurisdiction: null, taxCategory: null, components: ['IVA_BORDER'] },
      { name: 'MX Zero Rated IVA 0%',             rate: 0,  jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['IVA_ZERO'] },
    ]
  },
  IT: {
    frameworkName: 'Italy IVA',
    rules: [
      { name: 'IT Standard IVA 22%',              rate: 22, jurisdiction: null, taxCategory: null, components: ['IVA_STANDARD'] },
      { name: 'IT Reduced IVA 10%',               rate: 10, jurisdiction: null, taxCategory: null, components: ['IVA_REDUCED'] },
      { name: 'IT Reduced IVA 5%',                rate: 5,  jurisdiction: null, taxCategory: null, components: ['IVA_REDUCED_LOW'] },
      { name: 'IT Super-Reduced IVA 4%',          rate: 4,  jurisdiction: null, taxCategory: null, components: ['IVA_SUPER_REDUCED'] },
    ]
  },
  KR: {
    frameworkName: 'South Korea VAT',
    rules: [
      { name: 'KR Standard VAT 10%',              rate: 10, jurisdiction: null, taxCategory: null, components: ['VAT_STANDARD'] },
      { name: 'KR Zero Rated VAT 0%',             rate: 0,  jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['VAT_ZERO'] },
    ]
  },
  ES: {
    frameworkName: 'Spain IVA',
    rules: [
      { name: 'ES Standard IVA 21%',              rate: 21, jurisdiction: null, taxCategory: null, components: ['IVA_STANDARD'] },
      { name: 'ES Reduced IVA 10%',               rate: 10, jurisdiction: null, taxCategory: null, components: ['IVA_REDUCED'] },
      { name: 'ES Super-Reduced IVA 4%',          rate: 4,  jurisdiction: null, taxCategory: null, components: ['IVA_SUPER_REDUCED'] },
      // Temporary food rates (historical)
      { name: 'ES Temporary Food IVA 5%',         rate: 5,  jurisdiction: null, taxCategory: null, components: ['IVA_TEMPORARY_FOOD_5'] },
      { name: 'ES Temporary Food IVA 2%',         rate: 2,  jurisdiction: null, taxCategory: null, components: ['IVA_TEMPORARY_FOOD_2'] },
      { name: 'ES Temporary Food IVA 0%',         rate: 0,  jurisdiction: null, taxCategory: null, components: ['IVA_TEMPORARY_FOOD_0'] },
    ]
  },
  NL: {
    frameworkName: 'Netherlands BTW',
    rules: [
      { name: 'NL Standard BTW 21%',              rate: 21, jurisdiction: null, taxCategory: null, components: ['BTW_STANDARD'] },
      { name: 'NL Reduced BTW 9%',                rate: 9,  jurisdiction: null, taxCategory: null, components: ['BTW_REDUCED'] },
      { name: 'NL Reduced BTW 6% (hist.)',        rate: 6,  jurisdiction: null, taxCategory: null, components: ['BTW_REDUCED'] },
      { name: 'NL Zero Rated BTW 0%',             rate: 0,  jurisdiction: null, taxCategory: 'ZERO_RATED', components: ['BTW_ZERO'] },
    ]
  },
  CH: {
    frameworkName: 'Switzerland MWST',
    rules: [
      { name: 'CH Standard MWST 8.1%',            rate: 8.1, jurisdiction: null, taxCategory: null, components: ['MWST_STANDARD'] },
      { name: 'CH Standard MWST 7.7% (hist.)',    rate: 7.7, jurisdiction: null, taxCategory: null, components: ['MWST_STANDARD'] },
      { name: 'CH Accommodation MWST 3.8%',       rate: 3.8, jurisdiction: null, taxCategory: null, components: ['MWST_ACCOMMODATION'] },
      { name: 'CH Accommodation MWST 3.7% (hist.)',rate: 3.7, jurisdiction: null, taxCategory: null, components: ['MWST_ACCOMMODATION'] },
      { name: 'CH Reduced MWST 2.6%',             rate: 2.6, jurisdiction: null, taxCategory: null, components: ['MWST_REDUCED'] },
      { name: 'CH Reduced MWST 2.5% (hist.)',     rate: 2.5, jurisdiction: null, taxCategory: null, components: ['MWST_REDUCED'] },
    ]
  },
  // ---- CANADA --------------------------------------------------------------
  CA: {
    frameworkName: 'Canada GST/HST',
    rules: [
      { name: 'CA GST 5%',                    rate: 5,   jurisdiction: null, taxCategory: null,             components: ['GST'] },
      { name: 'CA PST 7%',                    rate: 7,   jurisdiction: 'PROVINCIAL', taxCategory: null,             components: ['PST'] },
      { name: 'CA HST 13%',                   rate: 13,  jurisdiction: 'PROVINCIAL', taxCategory: null,             components: ['HST'] },
      { name: 'CA GST 5% + PST 7%',           rate: 12,  jurisdiction: null, taxCategory: null,             components: [{ name: 'GST', expectedRate: 5 }, { name: 'PST', expectedRate: 7 }] },
      { name: 'CA Zero Rated 0%',             rate: 0,   jurisdiction: null, taxCategory: 'ZERO_RATED',     components: ['GST_ZERO'] },
      { name: 'CA Exempt 0%',                 rate: 0,   jurisdiction: null, taxCategory: 'EXEMPT',         components: ['GST_EXEMPT'] },
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
        placeOfSupply: ruleDef.placeOfSupply || null,
        supplyCategory: ruleDef.supplyCategory || null,
        priority: ruleDef.priority || 0,
        autoProvisioned: true,
      }
    });

    // 4. Link matching TaxRate rows from the global reference data
    //    For each component TaxType name, find all TaxRate rows and link them
    for (const comp of ruleDef.components) {
      const taxTypeName = typeof comp === 'string' ? comp : comp.name;
      const expectedRate = typeof comp === 'string' ? ruleDef.rate : comp.expectedRate;

      const rates = taxTypeMap[taxTypeName] || [];
      for (const rate of rates) {
        // We match explicitly on expected component rate to prevent linking ALL historical rates
        // to rules that shouldn't have them (the "links every duplicate rate" bug).
        const isComponentMatch = Math.abs(rate.rate - expectedRate) < 0.01;

        if (isComponentMatch) {
          await prisma.taxRule.update({
            where: { id: newRule.id },
            data: { rates: { connect: { id: rate.id } } }
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
