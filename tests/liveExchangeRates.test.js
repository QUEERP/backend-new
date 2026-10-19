/**
 * Automated Test Suite for Real Live Exchange Rates
 * Verifies all 7 required scenarios:
 * 1. Successful fetch inserts a row
 * 2. Duplicate fetch is skipped
 * 3. API down -> last rate used with warning
 * 4. No rate ever -> save blocked (never default to 1.0)
 * 5. Backdated invoice uses the older stored rate (effectiveDate <= docDate)
 * 6. CAD and AED resolve correctly
 * 7. Statutory rate is not overwritten by the API
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = require('../src/config/prisma');
const { LiveRateSyncService } = require('../src/services/fx/liveRateSyncService');
const { RateProviderService } = require('../src/services/fx/rateProvider');
const { CurrencyService } = require('../src/services/currencyService');

// Mock Rate Provider Adapter
class MockRateProvider {
  constructor({ name = 'mock-live-api', rates = {}, shouldFail = false }) {
    this.name = name;
    this.rates = rates; // Foreign CCY -> INR rate
    this.shouldFail = shouldFail;
    this.fetchCount = 0;
  }

  async fetchRates(baseCurrency, targetCurrencies = []) {
    this.fetchCount++;
    if (this.shouldFail) {
      throw new Error(`[MockProvider] ${this.name} connection timeout / HTTP 503 Service Unavailable`);
    }
    return {
      provider: this.name,
      source: `API:${this.name}`,
      baseCurrency,
      date: new Date().toISOString().slice(0, 10),
      rates: { ...this.rates },
      fetchedAt: new Date(),
      effectiveDate: new Date()
    };
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('       LIVE EXCHANGE RATES & RESOLUTION TEST SUITE (PHASE 9)          ');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(testName, details = '') {
    passed++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       ${details}`);
  }

  function fail(testName, err) {
    failed++;
    console.error(`[FAIL] ${testName}`);
    console.error(err);
  }

  // Find or create test business with INR base currency
  let business = await prisma.business.findFirst({
    where: {
      OR: [
        { currency: 'INR' },
        { country: 'INDIA' }
      ],
      isActive: true
    },
    include: { baseCurrency: true }
  }) || await prisma.business.findFirst({
    where: { isActive: true },
    include: { baseCurrency: true }
  });

  if (!business) {
    throw new Error('No active business found in database.');
  }

  // Ensure Base currency INR and foreign currencies CAD, AED, USD exist in master table
  const baseCurrency = await prisma.currency.upsert({
    where: { code: 'INR' },
    update: {},
    create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 }
  });

  const cadCurrency = await prisma.currency.upsert({
    where: { code: 'CAD' },
    update: {},
    create: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 }
  });

  const aedCurrency = await prisma.currency.upsert({
    where: { code: 'AED' },
    update: {},
    create: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', decimals: 2 }
  });

  const usdCurrency = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 }
  });

  // Ensure business has baseCurrencyId set to INR and reload
  if (business.baseCurrencyId !== baseCurrency.id || business.currency !== 'INR') {
    await prisma.business.update({
      where: { id: business.id },
      data: { baseCurrencyId: baseCurrency.id, currency: 'INR' }
    });
  }

  business = await prisma.business.findUnique({
    where: { id: business.id },
    include: { baseCurrency: true }
  });

  console.log(`Using Business: "${business.name}" (${business.id}), Base Currency: ${business.baseCurrency?.code || business.currency || 'INR'}\n`);

  // -------------------------------------------------------------------------
  // TEST 1: Successful fetch inserts a row
  // -------------------------------------------------------------------------
  try {
    const mockRates = {
      CAD: 60.20,
      AED: 22.80,
      USD: 83.90
    };

    const mockAdapter = new MockRateProvider({ name: 'mock-test-api', rates: mockRates });
    const mockProviderService = new RateProviderService(mockAdapter);
    const syncService = new LiveRateSyncService(mockProviderService);

    // Clean up any test rows for today with this specific source to ensure clean test state
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.exchangeRate.deleteMany({
      where: {
        fromCurrencyId: cadCurrency.id,
        toCurrencyId: baseCurrency.id,
        source: 'API:mock-test-api'
      }
    });

    const syncResult = await syncService.syncRatesForBusiness(business.id, {
      forceRefresh: true,
      currenciesInUse: ['CAD', 'AED', 'USD']
    });

    assert.ok(syncResult.syncedCount >= 1, `Expected at least 1 synced rate, got ${syncResult.syncedCount}`);

    // Verify row in DB
    const insertedCad = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrencyId: cadCurrency.id,
        toCurrencyId: baseCurrency.id,
        rateType: 'COMMERCIAL',
        source: 'API:mock-test-api'
      },
      orderBy: { createdAt: 'desc' }
    });

    assert.ok(insertedCad, 'Expected CAD exchange_rate record inserted in DB');
    assert.strictEqual(Number(insertedCad.rate), 60.20, 'CAD rate must be 60.20');
    assert.strictEqual(insertedCad.source, 'API:mock-test-api');
    assert.strictEqual(insertedCad.rateType, 'COMMERCIAL');
    assert.ok(insertedCad.fetchedAt, 'fetchedAt must be timestamped');

    pass('Test 1: Successful fetch inserts a row in exchange_rates', `Inserted CAD @ 60.20 INR, source: API:mock-test-api, fetchedAt: ${insertedCad.fetchedAt.toISOString()}`);
  } catch (err) {
    fail('Test 1: Successful fetch inserts a row', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Duplicate fetch is skipped (never overwrite or delete existing rows)
  // -------------------------------------------------------------------------
  try {
    const mockRates = {
      CAD: 60.20,
      AED: 22.80,
      USD: 83.90
    };

    const mockAdapter = new MockRateProvider({ name: 'mock-test-api', rates: mockRates });
    const mockProviderService = new RateProviderService(mockAdapter);
    const syncService = new LiveRateSyncService(mockProviderService);

    const countBefore = await prisma.exchangeRate.count({
      where: {
        fromCurrencyId: cadCurrency.id,
        toCurrencyId: baseCurrency.id,
        source: 'API:mock-test-api'
      }
    });

    // Run sync again with same rates
    const secondSync = await syncService.syncRatesForBusiness(business.id, {
      forceRefresh: true,
      currenciesInUse: ['CAD']
    });

    const countAfter = await prisma.exchangeRate.count({
      where: {
        fromCurrencyId: cadCurrency.id,
        toCurrencyId: baseCurrency.id,
        source: 'API:mock-test-api'
      }
    });

    assert.ok(secondSync.skippedCount >= 1, `Expected at least 1 skipped rate, got ${secondSync.skippedCount}`);
    assert.strictEqual(countAfter, countBefore, 'Row count must not increase when same provider/date/rate is synced');

    pass('Test 2: Duplicate fetch is skipped', `Identical provider/date/rate was safely skipped without creating duplicates (count: ${countAfter})`);
  } catch (err) {
    fail('Test 2: Duplicate fetch is skipped', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: API down -> last stored rate used with warning
  // -------------------------------------------------------------------------
  try {
    // Failing provider adapter simulating 503 outage
    const failingAdapter = new MockRateProvider({ name: 'mock-offline-api', shouldFail: true });
    const failingProviderService = new RateProviderService(failingAdapter);
    // Amber warning threshold: 0 hours (so any stored rate triggers warning)
    const fallbackSyncService = new LiveRateSyncService(failingProviderService, 0, 7);

    const lastStoredCad = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrencyId: cadCurrency.id,
        toCurrencyId: baseCurrency.id,
        rateType: 'COMMERCIAL'
      },
      orderBy: { effectiveDate: 'desc' }
    });
    assert.ok(lastStoredCad, 'A stored rate for CAD must exist in DB from previous sync');

    // Age the rate by 26 hours to trigger amber age warning (> 24h)
    const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);
    await prisma.exchangeRate.update({
      where: { id: lastStoredCad.id },
      data: { fetchedAt: twentySixHoursAgo }
    });

    // Resolving CAD when API is down should gracefully fall back to the last stored rate
    const resolvedFallback = await fallbackSyncService.resolveCommercialRate(business.id, 'CAD', new Date());

    assert.strictEqual(resolvedFallback.currency, 'CAD');
    assert.strictEqual(Number(resolvedFallback.rate), Number(lastStoredCad.rate), `Should fall back to last stored rate of ${lastStoredCad.rate}`);
    assert.ok(resolvedFallback.warningLevel === 'AMBER' || resolvedFallback.warningLevel === 'RED', 'Should return age warning when rate is older');
    assert.ok(resolvedFallback.warningMessage, 'Should provide user-facing warning message');

    pass('Test 3: API down -> last rate used with warning', `Gracefully resolved 1 CAD = ${resolvedFallback.rate} INR with warning level: ${resolvedFallback.warningLevel}`);
  } catch (err) {
    fail('Test 3: API down -> last rate used with warning', err);
  }

  // -------------------------------------------------------------------------
  // TEST 4: No rate ever -> save blocked ("No exchange rate for <CCY>")
  // -------------------------------------------------------------------------
  try {
    const failingAdapter = new MockRateProvider({ name: 'mock-offline-api', shouldFail: true });
    const syncService = new LiveRateSyncService(new RateProviderService(failingAdapter));

    let threwExpected = false;
    let thrownMessage = '';

    try {
      await syncService.resolveCommercialRate(business.id, 'ZZZ', new Date());
    } catch (resolutionErr) {
      threwExpected = true;
      thrownMessage = resolutionErr.message;
    }

    assert.strictEqual(threwExpected, true, 'Must throw error when no rate has ever existed');
    assert.ok(thrownMessage.includes('No exchange rate for ZZZ'), `Expected error message to contain "No exchange rate for ZZZ", got: "${thrownMessage}"`);

    // Verify it NEVER defaults to 1.0!
    assert.notStrictEqual(thrownMessage, '1.0');

    pass('Test 4: No rate ever -> save blocked', `Successfully threw "${thrownMessage}" and refused to default to 1.0`);
  } catch (err) {
    fail('Test 4: No rate ever -> save blocked', err);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Backdated invoice uses the older stored rate (effectiveDate <= docDate)
  // -------------------------------------------------------------------------
  try {
    const tMinus10Days = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const tMinus5Days = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const tMinus1Day = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    // Create an older historical rate at T-10 days: 1 CAD = 55.00 INR
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: cadCurrency.id,
        toCurrencyId: baseCurrency.id,
        rate: 55.00,
        effectiveDate: tMinus10Days,
        source: 'API:historical-t10',
        rateType: 'COMMERCIAL',
        fetchedAt: tMinus10Days
      }
    });

    // Create a newer rate at T-1 day: 1 CAD = 62.00 INR
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: cadCurrency.id,
        toCurrencyId: baseCurrency.id,
        rate: 62.00,
        effectiveDate: tMinus1Day,
        source: 'API:historical-t1',
        rateType: 'COMMERCIAL',
        fetchedAt: tMinus1Day
      }
    });

    // Offline provider to prevent on-demand live overwrite of backdated query
    const offlineSyncService = new LiveRateSyncService(new RateProviderService(new MockRateProvider({ shouldFail: true })));

    // Document backdated to T-5 days: should pick rate from T-10 (55.00), NOT T-1 (62.00)
    const backdatedResolution = await offlineSyncService.resolveCommercialRate(business.id, 'CAD', tMinus5Days);

    assert.strictEqual(Number(backdatedResolution.rate), 55.00, `Backdated rate for T-5 days must be 55.00, got ${backdatedResolution.rate}`);
    assert.strictEqual(backdatedResolution.source, 'API:historical-t10');

    pass('Test 5: Backdated invoice uses the older stored rate', `Invoice dated ${tMinus5Days.toISOString().slice(0, 10)} resolved rate 55.00 INR (effective: ${tMinus10Days.toISOString().slice(0, 10)}), correctly ignoring newer rate 62.00 INR`);
  } catch (err) {
    fail('Test 5: Backdated invoice uses the older stored rate', err);
  }

  // -------------------------------------------------------------------------
  // TEST 6: CAD and AED resolve correctly
  // -------------------------------------------------------------------------
  try {
    const mockRates = {
      CAD: 60.20,
      AED: 22.80
    };

    const mockAdapter = new MockRateProvider({ name: 'mock-cad-aed', rates: mockRates });
    const syncService = new LiveRateSyncService(new RateProviderService(mockAdapter));

    // Seed/sync rates
    await syncService.syncRatesForBusiness(business.id, {
      forceRefresh: true,
      currenciesInUse: ['CAD', 'AED']
    });

    const cadRes = await syncService.resolveCommercialRate(business.id, 'CAD');
    const aedRes = await syncService.resolveCommercialRate(business.id, 'AED');

    assert.strictEqual(cadRes.currency, 'CAD');
    assert.strictEqual(cadRes.baseCurrency, 'INR');
    assert.ok(Number(cadRes.rate) > 0, 'CAD rate must resolve to a valid positive commercial rate');

    assert.strictEqual(aedRes.currency, 'AED');
    assert.strictEqual(aedRes.baseCurrency, 'INR');
    assert.ok(Number(aedRes.rate) > 0, 'AED rate must resolve to a valid positive commercial rate');

    pass('Test 6: CAD and AED resolve correctly', `1 CAD = ${Number(cadRes.rate).toFixed(4)} INR, 1 AED = ${Number(aedRes.rate).toFixed(4)} INR (Base: ${cadRes.baseCurrency})`);
  } catch (err) {
    fail('Test 6: CAD and AED resolve correctly', err);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Statutory rate is not overwritten by the API
  // -------------------------------------------------------------------------
  try {
    const mockRates = {
      USD: 83.50 // Market commercial rate
    };

    const mockAdapter = new MockRateProvider({ name: 'mock-market-api', rates: mockRates });
    const syncService = new LiveRateSyncService(new RateProviderService(mockAdapter));

    const periodDate = new Date();
    const statutoryOfficialRate = 85.00; // CBIC notified customs rate

    // 1. Save statutory rate for USD
    const statutoryRecord = await syncService.saveStatutoryRate({
      businessId: business.id,
      currencyCode: 'USD',
      rate: statutoryOfficialRate,
      effectiveDate: periodDate,
      source: 'CBIC Notification No. 12/2026 - Customs'
    });

    assert.strictEqual(statutoryRecord.rateType, 'STATUTORY');
    assert.strictEqual(Number(statutoryRecord.rate), 85.00);
    assert.strictEqual(statutoryRecord.source, 'CBIC Notification No. 12/2026 - Customs');

    // 2. Run market API sync which syncs USD commercial rate (83.50)
    await syncService.syncRatesForBusiness(business.id, {
      forceRefresh: true,
      currenciesInUse: ['USD']
    });

    // 3. Verify statutory rate in DB was NOT overwritten by the commercial API sync
    const checkStatutory = await prisma.exchangeRate.findUnique({
      where: { id: statutoryRecord.id }
    });

    assert.ok(checkStatutory, 'Statutory record must still exist');
    assert.strictEqual(Number(checkStatutory.rate), 85.00, 'Statutory rate must remain 85.00 and NOT be overwritten by commercial 83.50');
    assert.strictEqual(checkStatutory.rateType, 'STATUTORY');
    assert.strictEqual(checkStatutory.source, 'CBIC Notification No. 12/2026 - Customs');

    // Verify commercial rate is stored separately
    const checkCommercial = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrencyId: usdCurrency.id,
        toCurrencyId: baseCurrency.id,
        rateType: 'COMMERCIAL',
        source: 'API:mock-market-api'
      }
    });

    assert.ok(checkCommercial, 'Commercial rate must exist in its own separate row');
    assert.strictEqual(Number(checkCommercial.rate), 83.50);

    pass('Test 7: Statutory rate is not overwritten by the API', `Statutory rate remains 85.00 (CBIC-Notified) while Market API rate is stored separately as 83.50 (COMMERCIAL)`);
  } catch (err) {
    fail('Test 7: Statutory rate is not overwritten by the API', err);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
