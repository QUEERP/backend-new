/**
 * step1_create_de_biz_via_api.js
 *
 * STEP 1 — Creates a German business through the REAL end-user API (POST /api/business/create),
 *           then queries the live DB and prints the actual TaxRule rows created by provisioning.
 *
 * STEP 2 — Immediately runs the Aug 2020 COVID-rate backdating test against the SAME businessId
 *           using TaxEngine.calculateTax() directly against the DB.
 *
 * NO seed scripts. NO direct prisma.business.create(). Real API call, real DB query output.
 */

require('dotenv').config();
const http = require('http');
const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_HOST = 'localhost';
const API_PORT = process.env.PORT || 5002;

// Real end-user flow: register a fresh user, then log in, then create the business.
// This is exactly what a new end-user does — no seed scripts, no admin bypass.
const TEST_USER_EMAIL    = `de_test_user_${Date.now()}@example.com`;
const TEST_USER_PASSWORD = 'TestPass@123';
const TEST_USER_NAME     = 'DE Integration Tester';

// The German business we are about to create via the real API
const BIZ_NAME    = `Berliner Testfirma GmbH [${new Date().toISOString()}]`;
const BIZ_COUNTRY = 'DE';
const BIZ_TYPE    = 'Trading';

// ─── HTTP HELPER ─────────────────────────────────────────────────────────────
function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  let exitCode = 0;

  try {
    // =========================================================================
    // STEP 1A — Register a fresh user via real API (end-user registration flow)
    // =========================================================================
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('STEP 1A — Register new user via POST /api/auth/register');
    console.log(`  email: ${TEST_USER_EMAIL}`);
    console.log('══════════════════════════════════════════════════════════════');

    const regRes = await apiCall('POST', '/api/auth/register', {
      name:     TEST_USER_NAME,
      email:    TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    console.log(`  HTTP ${regRes.status}`);
    if (regRes.status !== 201 && regRes.status !== 200) {
      console.error('  REGISTRATION FAILED:');
      console.error(JSON.stringify(regRes.body, null, 2));
      throw new Error('Registration failed — cannot proceed');
    }
    console.log(`  ✓ User registered: ${TEST_USER_NAME} <${TEST_USER_EMAIL}>`);

    // =========================================================================
    // STEP 1B — Login with the newly registered user
    // =========================================================================
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('STEP 1B — Login via POST /api/auth/login');
    console.log('══════════════════════════════════════════════════════════════');

    const loginRes = await apiCall('POST', '/api/auth/login', {
      email:    TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    console.log(`  HTTP ${loginRes.status}`);
    if (loginRes.status !== 200 || !loginRes.body.token) {
      console.error('  LOGIN FAILED:');
      console.error(JSON.stringify(loginRes.body, null, 2));
      throw new Error('Login failed — cannot proceed');
    }

    const JWT = loginRes.body.token;
    console.log(`  ✓ JWT obtained: ${JWT.slice(0, 40)}…`);

    // =========================================================================
    // STEP 1B — Create German business via real API
    // =========================================================================
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('STEP 1B — Create German business via POST /api/business/create');
    console.log(`  name:        "${BIZ_NAME}"`);
    console.log(`  country:     ${BIZ_COUNTRY}`);
    console.log(`  businessType: ${BIZ_TYPE}`);
    console.log('══════════════════════════════════════════════════════════════');

    const createRes = await apiCall('POST', '/api/business/create', {
      name:         BIZ_NAME,
      country:      BIZ_COUNTRY,
      businessType: BIZ_TYPE
    }, JWT);

    console.log(`  HTTP ${createRes.status}`);
    if (createRes.status !== 201 || !createRes.body.data?.id) {
      console.error('  BUSINESS CREATION FAILED — server response:');
      console.error(JSON.stringify(createRes.body, null, 2));
      throw new Error('Business creation failed — cannot proceed');
    }

    const businessId = createRes.body.data.id;
    console.log('');
    console.log('  ✓ Business created successfully');
    console.log(`  businessId : ${businessId}`);
    console.log(`  name       : ${createRes.body.data.name}`);
    console.log(`  countryCode: ${createRes.body.data.countryCode}`);
    console.log(`  taxType    : ${createRes.body.data.taxType}`);

    // =========================================================================
    // STEP 1C — Raw DB query: show every TaxRule row for this businessId
    // =========================================================================
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('STEP 1C — DB query: TaxRule rows for this business');
    console.log(`  SELECT * FROM "TaxRule" WHERE "businessId" = '${businessId}';`);
    console.log('══════════════════════════════════════════════════════════════');

    const taxRules = await prisma.taxRule.findMany({
      where: { businessId },
      include: {
        rates: {
          orderBy: { effectiveFrom: 'asc' },
          select: {
            id: true,
            name: true,
            rate: true,
            effectiveFrom: true,
            effectiveTo: true,
          }
        }
      },
      orderBy: { rate: 'asc' }
    });

    console.log('');
    console.log(`  Total TaxRule rows: ${taxRules.length}`);
    console.log('');

    if (taxRules.length === 0) {
      console.error('  ✗ ZERO TaxRules created — provisioning did NOT run or failed silently');
      exitCode = 1;
    } else {
      console.log(`  ${'id'.padEnd(36)} | ${'name'.padEnd(40)} | ${'rate'.padEnd(5)} | ${'taxCategory'.padEnd(16)} | auto | linkedRates`);
      console.log(`  ${'-'.repeat(36)} | ${'-'.repeat(40)} | ${'-'.repeat(5)} | ${'-'.repeat(16)} | ---- | -----------`);
      for (const r of taxRules) {
        const ratesStr = r.rates.map(rt =>
          `${rt.rate}%(${rt.effectiveFrom.toISOString().slice(0,10)}→${rt.effectiveTo?.toISOString().slice(0,10) ?? 'now'})`
        ).join(', ') || '(none)';

        console.log(`  ${r.id.padEnd(36)} | ${r.name.padEnd(40)} | ${String(r.rate).padEnd(5)} | ${(r.taxCategory||'null').padEnd(16)} | ${r.autoProvisioned ? 'yes' : 'no '} | ${ratesStr}`);
      }
    }

    // =========================================================================
    // STEP 2 — COVID backdating test: Aug 2020 → must resolve 16%, not 19%
    // =========================================================================
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('STEP 2 — Backdating test: Aug 2020 invoice → COVID 16% rate');
    console.log(`  businessId: ${businessId}`);
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');

    const probes = [
      { label: 'PROBE 1 — 2020-08-15 (COVID window),  taxPercent=16,  expected taxAmount=160', date: new Date('2020-08-15'), taxPercent: 16, expected: 160 },
      { label: 'PROBE 2 — 2021-06-01 (post-COVID),    taxPercent=19,  expected taxAmount=190', date: new Date('2021-06-01'), taxPercent: 19, expected: 190 },
      { label: 'PROBE 3 — 2019-05-01 (pre-COVID),     taxPercent=19,  expected taxAmount=190', date: new Date('2019-05-01'), taxPercent: 19, expected: 190 },
    ];

    let allProbesPass = true;

    for (const probe of probes) {
      console.log(`  ${probe.label}`);
      try {
        const txns = await TaxEngine.calculateTax({
          businessId,
          lineSubtotal:    1000,
          taxPercent:      probe.taxPercent,
          transactionDate: probe.date,
        });

        const taxAmount = txns[0]?.taxAmountTxnCcy;
        const resolvedRate = txns[0] ? `taxRateId=${txns[0].taxRateId}` : '(no row)';
        const pass = taxAmount === probe.expected;

        console.log(`    TaxEngine returned ${txns.length} TaxTransaction row(s)`);
        console.log(`    taxAmountTxnCcy = ${taxAmount}  (expected ${probe.expected})  ${resolvedRate}`);
        console.log(`    → ${pass ? 'PASS ✓' : 'FAIL ✗'}`);

        if (!pass) allProbesPass = false;
      } catch (err) {
        console.log(`    → ERROR: ${err.message}`);
        allProbesPass = false;
      }
      console.log('');
    }

    // Guard probe: passing taxPercent=16 on a 2021 date should THROW
    console.log('  PROBE 4 — 2021-03-01 (post-COVID),  taxPercent=16,  expected: RateResolutionError thrown');
    try {
      await TaxEngine.calculateTax({
        businessId,
        lineSubtotal:    1000,
        taxPercent:      16,
        transactionDate: new Date('2021-03-01'),
      });
      console.log('    → FAIL ✗ (engine returned a result — should have thrown)');
      allProbesPass = false;
    } catch (err) {
      console.log(`    → correctly threw: "${err.message}"`);
      console.log(`    → PASS ✓`);
    }
    console.log('');

    // =========================================================================
    // FINAL VERDICT
    // =========================================================================
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`OVERALL: TaxRules created=${taxRules.length} | All probes pass=${allProbesPass}`);
    if (taxRules.length > 0 && allProbesPass) {
      console.log('RESULT: ✓ STEP 1 and STEP 2 both VERIFIED');
    } else {
      console.log('RESULT: ✗ FAILURES DETECTED — do NOT proceed to steps 3/4');
      exitCode = 1;
    }
    console.log('══════════════════════════════════════════════════════════════');

  } catch (err) {
    console.error('');
    console.error('FATAL:', err.message);
    exitCode = 1;
  } finally {
    await prisma.$disconnect();
    process.exit(exitCode);
  }
}

main();
