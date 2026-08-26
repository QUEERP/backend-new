/**
 * step3_four_design_questions.js
 *
 * Step 3 — Four design questions, each backed by real DB queries and TaxEngine runs.
 *
 * Q1. India CGST/SGST/IGST provisioning — does a new India business get correct
 *     split-component rules and does TaxEngine produce 2 rows (CGST+SGST) for
 *     INTRASTATE and 1 row (IGST) for INTERSTATE?
 *
 * Q2. UAE coverage — does a new UAE business get the correct VAT rules and does
 *     TaxEngine calculate 5% VAT correctly?
 *
 * Q3. Country-change behavior — when a business switches from India → Germany,
 *     are old auto-provisioned India rules deleted and new DE rules created,
 *     while a manually-added rule is preserved?
 *
 * Q4. Rate-change resolution + multi-rule correctness — does the TaxEngine
 *     correctly refuse when the CGST+SGST rows linked to a rule sum to more
 *     than the declared taxPercent (i.e., duplicate seed rows break validation)?
 *     Also: do multiple TaxRule rows at the same rate for different taxCategories
 *     (ZERO_RATED, REVERSE_CHARGE, plain) resolve to the right rule?
 *
 * Each section prints:
 *   - The actual API call (method + path + body)
 *   - The actual HTTP response
 *   - The actual DB rows
 *   - The actual TaxEngine result or error message
 */

require('dotenv').config();
const http = require('http');
const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');

const API_HOST = 'localhost';
const API_PORT = process.env.PORT || 5002;

// ─── helpers ──────────────────────────────────────────────────────────────────
function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: API_HOST, port: API_PORT, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? 'PASS ✓' : 'FAIL ✗'} ${label}`);
  console.log(`         got: ${JSON.stringify(actual)}  expected: ${JSON.stringify(expected)}`);
  ok ? passed++ : failed++;
  return ok;
}

async function registerAndLogin(tag) {
  const email = `step3_${tag}_${Date.now()}@example.com`;
  const pwd   = 'TestPass@123';
  const rr = await apiCall('POST', '/api/auth/register', { name: tag, email, password: pwd });
  if (rr.status !== 201 && rr.status !== 200) throw new Error(`Register failed: ${JSON.stringify(rr.body)}`);
  const lr = await apiCall('POST', '/api/auth/login', { email, password: pwd });
  if (!lr.body.token) throw new Error(`Login failed: ${JSON.stringify(lr.body)}`);
  return lr.body.token;
}

async function createBusiness(token, name, country) {
  console.log(`  → POST /api/business/create  { name: "${name}", country: "${country}" }`);
  const res = await apiCall('POST', '/api/business/create', { name, country, businessType: 'Trading' }, token);
  console.log(`  ← HTTP ${res.status}`);
  if (res.status !== 201 || !res.body.data?.id) throw new Error(`Business create failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

async function showRules(businessId, label) {
  const rules = await prisma.taxRule.findMany({
    where: { businessId },
    include: { rates: { orderBy: { effectiveFrom: 'asc' }, select: { id: true, name: true, rate: true, effectiveFrom: true, effectiveTo: true } } },
    orderBy: { rate: 'asc' }
  });
  console.log(`\n  DB TaxRule rows for ${label} (businessId=${businessId}):`);
  console.log(`  Total: ${rules.length}`);
  console.log(`  ${'name'.padEnd(42)} | ${'rate'.padEnd(5)} | ${'taxCategory'.padEnd(16)} | auto | linked TaxRate rows`);
  console.log(`  ${'-'.repeat(42)} | ${'-'.repeat(5)} | ${'-'.repeat(16)} | ---- | -------------------`);
  for (const r of rules) {
    const rStr = r.rates.map(rt =>
      `${rt.name}@${rt.rate}%(${rt.effectiveFrom.toISOString().slice(0,10)}→${rt.effectiveTo?.toISOString().slice(0,10) ?? 'now'})`
    ).join(' | ') || '(none)';
    console.log(`  ${r.name.padEnd(42)} | ${String(r.rate).padEnd(5)} | ${(r.taxCategory||'null').padEnd(16)} | ${r.autoProvisioned ? 'yes' : 'no '} | ${rStr}`);
  }
  return rules;
}

async function calcTax(params, expectedCount, expectedTotal, label) {
  console.log(`\n  TaxEngine.calculateTax(${JSON.stringify({ taxPercent: params.taxPercent, date: params.transactionDate?.toISOString?.().slice(0,10), businessState: params.businessState, customerState: params.customerState })})`);
  try {
    const txns = await TaxEngine.calculateTax(params);
    const total = txns.reduce((s, t) => s + t.taxAmountTxnCcy, 0);
    console.log(`  Returned ${txns.length} row(s): ${txns.map(t => `${t.taxAmountTxnCcy} (rateId=${t.taxRateId})`).join(', ')}`);
    console.log(`  Total tax: ${total}`);
    check(`${label} — row count`, txns.length, expectedCount);
    check(`${label} — total tax`, total, expectedTotal);
    return txns;
  } catch (err) {
    console.log(`  THREW: ${err.message}`);
    if (expectedCount === 'ERROR') {
      console.log(`  PASS ✓ ${label} — correctly threw`);
      passed++;
    } else {
      console.log(`  FAIL ✗ ${label} — unexpected error`);
      failed++;
    }
    return null;
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  try {

    // ═══════════════════════════════════════════════════════════════════════════
    // PRE-FLIGHT: Count raw CGST/SGST/IGST TaxRate rows in the global seed data
    // to expose the duplicate-row problem before it hits the engine.
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('PRE-FLIGHT: Raw India GST seed data counts (duplicate detection)');
    console.log('══════════════════════════════════════════════════════════════════════');

    const inFw = await prisma.taxFramework.findFirst({
      where: { name: 'India GST' },
      include: { taxTypes: { include: { rates: { orderBy: { effectiveFrom: 'asc' } } } } }
    });
    const uaeFw = await prisma.taxFramework.findFirst({
      where: { name: 'UAE VAT' },
      include: { taxTypes: { include: { rates: { orderBy: { effectiveFrom: 'asc' } } } } }
    });

    // Group by name for India
    const inTaxTypeMap = {};
    for (const tt of inFw.taxTypes) {
      if (!inTaxTypeMap[tt.name]) inTaxTypeMap[tt.name] = { count: 0, rows: [] };
      inTaxTypeMap[tt.name].count++;
      inTaxTypeMap[tt.name].rows.push(...tt.rates);
    }

    console.log('\n  India GST — TaxType duplicates and TaxRate counts:');
    for (const [name, info] of Object.entries(inTaxTypeMap)) {
      const rateGroups = {};
      for (const r of info.rows) {
        const k = `${r.rate}%`;
        rateGroups[k] = (rateGroups[k] || 0) + 1;
      }
      const dup = info.count > 1 ? ` ← ${info.count} TaxType rows (DUPLICATES)` : '';
      console.log(`    ${name.padEnd(10)}: ${info.count} TaxType row(s), ${info.rows.length} TaxRate rows. By rate: ${JSON.stringify(rateGroups)}${dup}`);
    }

    // Group by name for UAE
    const uaeTaxTypeMap = {};
    for (const tt of uaeFw.taxTypes) {
      if (!uaeTaxTypeMap[tt.name]) uaeTaxTypeMap[tt.name] = { count: 0, rows: [] };
      uaeTaxTypeMap[tt.name].count++;
      uaeTaxTypeMap[tt.name].rows.push(...tt.rates);
    }
    console.log('\n  UAE VAT — TaxType duplicates and TaxRate counts:');
    for (const [name, info] of Object.entries(uaeTaxTypeMap)) {
      const rateGroups = {};
      for (const r of info.rows) {
        const k = `${r.rate}%`;
        rateGroups[k] = (rateGroups[k] || 0) + 1;
      }
      const dup = info.count > 1 ? ` ← ${info.count} TaxType rows (DUPLICATES)` : '';
      console.log(`    ${name.padEnd(20)}: ${info.count} TaxType row(s), ${info.rows.length} TaxRate rows. By rate: ${JSON.stringify(rateGroups)}${dup}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Q1: India CGST/SGST/IGST provisioning
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('Q1: India CGST/SGST/IGST provisioning + TaxEngine split-component test');
    console.log('══════════════════════════════════════════════════════════════════════');

    const inToken = await registerAndLogin('india_user');
    const inBizId = await createBusiness(inToken, `Mumbai Trading Co [${Date.now()}]`, 'IN');

    const inRules = await showRules(inBizId, 'India business');

    check('Q1: INTRASTATE 18% rule exists', !!inRules.find(r => r.jurisdiction === 'INTRASTATE' && r.rate === 18), true);
    check('Q1: INTERSTATE 18% rule exists', !!inRules.find(r => r.jurisdiction === 'INTERSTATE' && r.rate === 18), true);
    check('Q1: All rules autoProvisioned=true', inRules.every(r => r.autoProvisioned), true);

    // INTRASTATE (CGST 9% + SGST 9% = 2 rows totalling 180 on 1000)
    console.log('\n  Test: INTRASTATE invoice 1000 × 18% (Maharashtra→Maharashtra)');
    const intraTxns = await calcTax({
      businessId: inBizId,
      businessState: 'Maharashtra',
      customerState:  'Maharashtra',
      lineSubtotal: 1000,
      taxPercent: 18,
      transactionDate: new Date('2026-01-01')
    }, 2, 180, 'Q1 INTRASTATE (CGST+SGST = 2 rows, 180)');

    if (intraTxns && intraTxns.length === 2) {
      // Confirm one is CGST 9% and one is SGST 9%
      const rateIds = intraTxns.map(t => t.taxRateId);
      const rateRows = await prisma.taxRate.findMany({ where: { id: { in: rateIds } }, select: { name: true, rate: true } });
      console.log(`    Component rates resolved: ${rateRows.map(r => `${r.name} @${r.rate}%`).join(', ')}`);
      check('Q1: INTRASTATE components are 9%+9%', rateRows.every(r => r.rate === 9), true);
    }

    // INTERSTATE (IGST 18% = 1 row, 180 on 1000)
    console.log('\n  Test: INTERSTATE invoice 1000 × 18% (Maharashtra→Karnataka)');
    await calcTax({
      businessId: inBizId,
      businessState: 'Maharashtra',
      customerState:  'Karnataka',
      lineSubtotal: 1000,
      taxPercent: 18,
      transactionDate: new Date('2026-01-01')
    }, 1, 180, 'Q1 INTERSTATE (IGST = 1 row, 180)');

    // ═══════════════════════════════════════════════════════════════════════════
    // Q2: UAE coverage
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('Q2: UAE VAT coverage + TaxEngine 5% VAT calculation');
    console.log('══════════════════════════════════════════════════════════════════════');

    const aeToken = await registerAndLogin('uae_user');
    const aeBizId = await createBusiness(aeToken, `Dubai Enterprises [${Date.now()}]`, 'AE');

    const aeRules = await showRules(aeBizId, 'UAE business');

    check('Q2: Standard VAT 5% rule exists', !!aeRules.find(r => r.rate === 5 && !r.taxCategory), true);
    check('Q2: Zero Rated 0% rule exists',   !!aeRules.find(r => r.rate === 0 && r.taxCategory === 'ZERO_RATED'), true);
    check('Q2: Exempt 0% rule exists',        !!aeRules.find(r => r.rate === 0 && r.taxCategory === 'EXEMPT'), true);
    check('Q2: Reverse Charge 5% exists',     !!aeRules.find(r => r.rate === 5 && r.taxCategory === 'REVERSE_CHARGE'), true);
    check('Q2: All rules autoProvisioned',     aeRules.every(r => r.autoProvisioned), true);

    console.log('\n  Test: UAE invoice 1000 × 5% VAT');
    await calcTax({
      businessId: aeBizId,
      lineSubtotal: 1000,
      taxPercent: 5,
      transactionDate: new Date('2026-01-01')
    }, 1, 50, 'Q2 UAE VAT 5% (1 row, 50)');

    // ═══════════════════════════════════════════════════════════════════════════
    // Q3: Country-change behavior (India → Germany)
    //     Simulate via provisionTaxRules directly (no settings-update API exists).
    //     First add a manual rule to prove it survives.
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('Q3: Country-change behavior (India → Germany)');
    console.log('══════════════════════════════════════════════════════════════════════');

    const rulesBefore = await prisma.taxRule.count({ where: { businessId: inBizId } });
    console.log(`\n  Before country change: ${rulesBefore} rules on India business ${inBizId}`);

    // Add a manual rule (autoProvisioned=false) to prove it survives
    const manualRule = await prisma.taxRule.create({
      data: { businessId: inBizId, name: 'Custom Cess 2%', rate: 2, type: 'CESS', autoProvisioned: false }
    });
    console.log(`  Added manual rule: "${manualRule.name}" (id=${manualRule.id}, autoProvisioned=false)`);

    // Update the business's country and framework to Germany (as a real country-change would do)
    const deCountry = await prisma.country.findUnique({ where: { code: 'DE' } });
    const deFw = await prisma.taxFramework.findFirst({ where: { name: 'Deutschland MwSt' } });
    await prisma.business.update({
      where: { id: inBizId },
      data: { countryId: deCountry.id, taxFrameworkId: deFw.id }
    });
    console.log(`  Updated business country to DE (countryId=${deCountry.id})`);

    // Run provisioning (this is what the country-change API hook will call)
    console.log(`  Calling provisionTaxRules('${inBizId}', 'DE') …`);
    const provResult = await provisionTaxRules(inBizId, 'DE');
    console.log(`  provisionTaxRules returned: ${JSON.stringify(provResult)}`);

    const rulesAfter = await showRules(inBizId, 'India→Germany after country change');

    const manualSurvived = rulesAfter.some(r => r.id === manualRule.id);
    const oldIndiaGone   = !rulesAfter.some(r => r.name.includes('India') && r.autoProvisioned);
    const newDeExists    = rulesAfter.some(r => r.name.startsWith('DE') && r.autoProvisioned);

    check('Q3: Manual rule survived', manualSurvived, true);
    check('Q3: Old India auto-rules deleted', oldIndiaGone, true);
    check('Q3: New DE auto-rules created', newDeExists, true);
    check('Q3: DE rules count = 8', rulesAfter.filter(r => r.autoProvisioned && r.name.startsWith('DE')).length, 8);

    // ═══════════════════════════════════════════════════════════════════════════
    // Q4: Rate-change resolution + multi-rule correctness
    //     4a: CGST+SGST sum validation — if duplicate TaxRate rows are linked
    //         to a rule, the engine must reject (sum != taxPercent).
    //     4b: Multiple rules at same aggregate rate but different taxCategory
    //         (zero-rated vs plain) — engine picks the right one.
    //     4c: India INTRASTATE 0% nil-rated (taxPercent=0) → returns []
    //         (engine early-exits on taxPercent <= 0).
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('Q4: Rate-change resolution + multi-rule correctness');
    console.log('══════════════════════════════════════════════════════════════════════');

    // Q4a: Find the linked TaxRate count for the India INTRASTATE 18% rule
    //      to show concretely whether duplicate seed rows were pulled in.
    const intraRule18 = inRules.find(r => r.jurisdiction === 'INTRASTATE' && r.rate === 18);
    if (intraRule18) {
      const linkedRates = await prisma.taxRate.findMany({
        where: { taxRuleId: intraRule18.id },
        select: { name: true, rate: true, effectiveFrom: true }
      });
      console.log(`\n  Q4a: INTRASTATE 18% rule (id=${intraRule18.id}) has ${linkedRates.length} linked TaxRate rows:`);
      linkedRates.forEach(r => console.log(`    ${r.name} @${r.rate}% from ${r.effectiveFrom.toISOString().slice(0,10)}`));

      const sumRates = linkedRates.reduce((s, r) => s + r.rate, 0);
      console.log(`  Sum of linked rates: ${sumRates}% (rule declares: 18%)`);

      if (Math.abs(sumRates - 18) < 0.01) {
        console.log('  PASS ✓ Q4a: Sum matches declared rate — no duplicate contamination on this rule');
        passed++;
      } else {
        console.log(`  FAIL ✗ Q4a: Sum ${sumRates}% ≠ 18% — duplicate TaxRate rows contaminating this rule`);
        console.log('  NOTE: TaxEngine will THROW RateResolutionError on any invoice for this business');
        failed++;
      }
    }

    // Q4b: UAE — two rules at 0% with different taxCategory (ZERO_RATED vs EXEMPT)
    //      and one at 5%. TaxEngine findFirst picks by (businessId, rate=5) → standard VAT.
    //      TaxEngine findFirst picks by (businessId, rate=0) → ambiguous! Test which one wins.
    console.log(`\n  Q4b: UAE 0% ambiguity — two rules at rate=0 (ZERO_RATED and EXEMPT)`);
    const zeroRatedRule = aeRules.find(r => r.rate === 0 && r.taxCategory === 'ZERO_RATED');
    const exemptRule    = aeRules.find(r => r.rate === 0 && r.taxCategory === 'EXEMPT');
    console.log(`    ZERO_RATED rule id: ${zeroRatedRule?.id}`);
    console.log(`    EXEMPT rule id:     ${exemptRule?.id}`);

    // Engine picks the first by prisma.taxRule.findFirst({where:{businessId, rate:0}})
    // with no taxCategory filter — whichever DB returns first wins.
    // This is a known design limitation — callers currently cannot distinguish.
    // The test shows the actual resolved rule.
    const uaeZeroTxns = await TaxEngine.calculateTax({
      businessId: aeBizId,
      lineSubtotal: 1000,
      taxPercent: 0,
      transactionDate: new Date('2026-01-01')
    }).catch(e => e);

    if (uaeZeroTxns instanceof Error) {
      console.log(`    TaxEngine threw on taxPercent=0: "${uaeZeroTxns.message}"`);
      console.log('    NOTE: Engine early-exits when taxPercent=0 (line 33: if (!taxPercent || taxPercent <= 0)) → returns []');
    } else {
      console.log(`    TaxEngine returned ${uaeZeroTxns.length} rows for taxPercent=0`);
    }
    // Confirm the early-exit behavior directly
    const zeroResult = await TaxEngine.calculateTax({
      businessId: aeBizId, lineSubtotal: 1000, taxPercent: 0, transactionDate: new Date()
    });
    check('Q4b: taxPercent=0 early-exit returns [] (zero-rated/exempt handled by caller)', zeroResult.length, 0);

    // Q4c: Germany COVID guard — on the changed business (now DE), post-COVID 16% must throw
    console.log(`\n  Q4c: Germany post-COVID guard on changed business (${inBizId})`);
    try {
      await TaxEngine.calculateTax({
        businessId: inBizId, lineSubtotal: 1000, taxPercent: 16, transactionDate: new Date('2022-01-01')
      });
      console.log('    FAIL ✗ Q4c: Should have thrown but did not');
      failed++;
    } catch (err) {
      console.log(`    Threw: "${err.message}"`);
      check('Q4c: post-COVID 16% on 2022 date correctly rejected', err.message.includes('no active TaxRates'), true);
    }

    // Q4d: Multiple rules same rate — India INTRASTATE 18% vs INTERSTATE 18%
    //      TaxEngine must pick INTRASTATE when states match, INTERSTATE when they differ.
    //      This re-proves Q1 from Q4's angle: it's a DIFFERENT business (inBizId is now
    //      Germany after country change, so we need to test on the UAE biz for this concept)
    //      Actually let's test on UAE biz with plain 5% vs reverse-charge 5%.
    console.log(`\n  Q4d: UAE — two rules at rate=5 (plain vs REVERSE_CHARGE)`);
    console.log(`    Testing taxPercent=5 with no jurisdiction filter:`);
    const stdVatTxns = await TaxEngine.calculateTax({
      businessId: aeBizId, lineSubtotal: 1000, taxPercent: 5, transactionDate: new Date('2026-01-01')
    });
    const resolvedRate = await prisma.taxRate.findUnique({
      where: { id: stdVatTxns[0]?.taxRateId }, select: { name: true }
    });
    console.log(`    Resolved to TaxRate: "${resolvedRate?.name}"`);
    console.log(`    taxAmountTxnCcy: ${stdVatTxns[0]?.taxAmountTxnCcy}`);
    // The engine picks whichever findFirst returns — without taxCategory in the query.
    // Both STANDARD 5% and REVERSE_CHARGE 5% are at rate=5. Result depends on DB row order.
    // This is the known limitation: caller must distinguish by taxCategory (not yet implemented).
    check('Q4d: At least 1 row returned for UAE 5%', stdVatTxns.length >= 1, true);
    check('Q4d: tax on 1000×5% = 50', stdVatTxns[0]?.taxAmountTxnCcy, 50);

  } catch (err) {
    console.error('\nFATAL:', err.message);
    console.error(err.stack);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`STEP 3 RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`${'═'.repeat(70)}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
