/**
 * Live Exchange Rate Synchronization & Resolution Service
 * 
 * Implements:
 * 1. Business currency usage discovery (invoices, bills, payments, customers, vendors)
 * 2. Storing fetched rates with insert-only semantics (no overwrites, skips duplicate rate/provider/date)
 * 3. On-demand and scheduled live fetching
 * 4. Document rate resolution with age warnings (amber > 24h, red > 7d) and strict "No exchange rate for <CCY>" block
 * 5. Statutory (GST/CBIC) rate management strictly isolated from commercial API rates
 */

const prisma = require('../../config/prisma');
const { rateProviderService, RateProviderError } = require('./rateProvider');

class LiveRateSyncService {
  constructor(rateProvider = rateProviderService, amberThresholdHours, redThresholdDays) {
    this.rateProvider = rateProvider || rateProviderService;
    this.amberThresholdHours = amberThresholdHours !== undefined ? amberThresholdHours : (parseInt(process.env.RATE_STALE_AMBER_HOURS, 10) || 24);
    this.redThresholdDays = redThresholdDays !== undefined ? redThresholdDays : (parseInt(process.env.RATE_STALE_RED_DAYS, 10) || 7);
  }

  /**
   * Retrieves all unique currencies in use across business operations.
   */
  async getCurrenciesInUse(businessId, txClient = prisma) {
    const business = await txClient.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });

    const baseCcy = (business?.baseCurrency?.code || business?.currency || 'INR').toUpperCase();
    const currencies = new Set([baseCcy, 'USD', 'CAD', 'AED']); // Common defaults always checked

    // Query distinct currencies from operational documents
    const [invs, bills, pays, custs, vends] = await Promise.all([
      txClient.invoice.findMany({
        where: { businessId, currency: { not: null } },
        select: { currency: true },
        distinct: ['currency']
      }).catch(() => []),
      txClient.bill.findMany({
        where: { businessId, currency: { not: null } },
        select: { currency: true },
        distinct: ['currency']
      }).catch(() => []),
      txClient.payment.findMany({
        where: { businessId, currency: { not: null } },
        select: { currency: true },
        distinct: ['currency']
      }).catch(() => []),
      txClient.customer.findMany({
        where: { businessId, currency: { not: null } },
        select: { currency: true },
        distinct: ['currency']
      }).catch(() => []),
      txClient.vendor.findMany({
        where: { businessId, currency: { not: null } },
        select: { currency: true },
        distinct: ['currency']
      }).catch(() => [])
    ]);

    for (const item of [...invs, ...bills, ...pays, ...custs, ...vends]) {
      if (item.currency && typeof item.currency === 'string') {
        const cleaned = item.currency.trim().toUpperCase();
        if (cleaned && cleaned.length === 3) {
          currencies.add(cleaned);
        }
      }
    }

    return Array.from(currencies);
  }

  /**
   * Syncs live commercial exchange rates for a business.
   * Inserts new rows only; skips if identical provider/effectiveDate/rate already exists.
   */
  async syncRatesForBusiness(businessId, options = {}) {
    const { forceRefresh = false, txClient = prisma } = options;

    const business = await txClient.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });

    if (!business) {
      throw new Error(`Business not found: ${businessId}`);
    }

    const baseCode = (business.baseCurrency?.code || business.currency || 'INR').toUpperCase();
    let baseCurrency = await txClient.currency.findUnique({ where: { code: baseCode } });
    if (!baseCurrency) {
      baseCurrency = await txClient.currency.create({
        data: {
          code: baseCode,
          name: baseCode,
          symbol: baseCode === 'INR' ? '₹' : baseCode === 'AED' ? 'AED' : '$'
        }
      });
    }

    const currenciesInUse = options.currenciesInUse || (await this.getCurrenciesInUse(businessId, txClient));
    const foreignCurrencies = currenciesInUse.filter(c => c !== baseCode);

    if (foreignCurrencies.length === 0) {
      return { syncedCount: 0, skippedCount: 0, rates: [] };
    }

    let rateData;
    try {
      rateData = await this.rateProvider.getRates(baseCode, foreignCurrencies, forceRefresh);
    } catch (err) {
      console.error(`[LiveRateSyncService] Error fetching live rates for ${baseCode}:`, err.message);
      throw err;
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const results = [];

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    for (const ccyCode of foreignCurrencies) {
      const liveRate = rateData.rates[ccyCode];
      if (!liveRate || liveRate <= 0) {
        console.warn(`[LiveRateSyncService] No live rate returned from provider for ${ccyCode}`);
        continue;
      }

      // Ensure Currency master record exists
      let foreignCcy = await txClient.currency.findUnique({ where: { code: ccyCode } });
      if (!foreignCcy) {
        foreignCcy = await txClient.currency.create({
          data: {
            code: ccyCode,
            name: ccyCode,
            symbol: ccyCode === 'CAD' ? 'C$' : ccyCode === 'USD' ? '$' : ccyCode === 'AED' ? 'AED' : ccyCode
          }
        });
      }

      // Check if duplicate already exists (same fromCurrency, toCurrency, provider, rate, today's date)
      const existing = await txClient.exchangeRate.findFirst({
        where: {
          fromCurrencyId: foreignCcy.id,
          toCurrencyId: baseCurrency.id,
          rateType: 'COMMERCIAL',
          source: rateData.source,
          effectiveDate: { gte: startOfDay, lte: endOfDay }
        },
        orderBy: { effectiveDate: 'desc' }
      });

      if (existing) {
        // If the existing rate for this date is identical and same provider, skip insertion
        if (Math.abs(Number(existing.rate) - Number(liveRate)) < 0.000001) {
          skippedCount++;
          results.push({
            currency: ccyCode,
            rate: Number(existing.rate),
            action: 'SKIPPED_DUPLICATE',
            source: existing.source,
            effectiveDate: existing.effectiveDate,
            fetchedAt: existing.fetchedAt || existing.createdAt
          });
          continue;
        }
      }

      // Requirement 2: Never overwrite or delete existing rows; insert new rows only
      const insertDate = new Date();
      try {
        const newRecord = await txClient.exchangeRate.create({
          data: {
            fromCurrencyId: foreignCcy.id,
            toCurrencyId: baseCurrency.id,
            rate: liveRate,
            effectiveDate: insertDate,
            source: rateData.source,
            rateType: 'COMMERCIAL',
            fetchedAt: rateData.fetchedAt || new Date()
          }
        });

        syncedCount++;
        results.push({
          currency: ccyCode,
          rate: liveRate,
          action: 'INSERTED',
          source: newRecord.source,
          effectiveDate: newRecord.effectiveDate,
          fetchedAt: newRecord.fetchedAt
        });
      } catch (insertErr) {
        // If unique constraint hit concurrently, treat as skipped duplicate
        if (insertErr.code === 'P2002') {
          skippedCount++;
        } else {
          console.error(`[LiveRateSyncService] Failed to insert exchange rate for ${ccyCode}:`, insertErr.message);
        }
      }
    }

    return {
      syncedCount,
      skippedCount,
      provider: rateData.provider,
      source: rateData.source,
      fetchedAt: rateData.fetchedAt,
      results
    };
  }

  /**
   * Resolves the commercial rate for a currency as of a document date.
   * If stored rate is older than 24h or missing, triggers on-demand live fetch.
   * Returns rate details with freshness age warning.
   * Throws "No exchange rate for <CCY>" if no rate has ever existed.
   */
  async resolveCommercialRate(businessId, currencyCode, documentDate = new Date(), txClient = prisma) {
    const docDate = documentDate ? new Date(documentDate) : new Date();
    const ccyUpper = (currencyCode || 'INR').toUpperCase().trim();

    const business = await txClient.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });

    const baseCode = (business?.baseCurrency?.code || business?.currency || 'INR').toUpperCase();
    if (ccyUpper === baseCode) {
      return {
        currency: ccyUpper,
        baseCurrency: baseCode,
        rate: 1.0,
        source: 'BASE',
        rateType: 'COMMERCIAL',
        effectiveDate: docDate,
        fetchedAt: new Date(),
        isBase: true,
        warningLevel: 'NONE',
        warningMessage: null
      };
    }

    // Lookup currency in master
    const foreignCcy = await txClient.currency.findUnique({ where: { code: ccyUpper } });
    const baseCcy = await txClient.currency.findUnique({ where: { code: baseCode } });

    if (!foreignCcy || !baseCcy) {
      // Currency not in system master
      throw new Error(`No exchange rate for ${ccyUpper}`);
    }

    // Check latest stored rate
    let latestStored = await txClient.exchangeRate.findFirst({
      where: {
        fromCurrencyId: foreignCcy.id,
        toCurrencyId: baseCcy.id,
        rateType: 'COMMERCIAL',
        effectiveDate: { lte: docDate }
      },
      orderBy: { effectiveDate: 'desc' }
    });

    // Check age of latest stored rate
    const now = Date.now();
    const lastFetchedTime = latestStored ? new Date(latestStored.fetchedAt || latestStored.createdAt).getTime() : 0;
    const ageHours = lastFetchedTime > 0 ? (now - lastFetchedTime) / (1000 * 60 * 60) : 9999;

    // Trigger on-demand live fetch if latest stored is missing or older than 24h (and docDate is today/recent)
    const isTodayDoc = Math.abs(now - docDate.getTime()) < 24 * 60 * 60 * 1000;
    if ((!latestStored || ageHours >= this.amberThresholdHours) && isTodayDoc) {
      try {
        await this.syncRatesForBusiness(businessId, { forceRefresh: false, currenciesInUse: [ccyUpper], txClient });
        // Re-query after sync
        latestStored = await txClient.exchangeRate.findFirst({
          where: {
            fromCurrencyId: foreignCcy.id,
            toCurrencyId: baseCcy.id,
            rateType: 'COMMERCIAL',
            effectiveDate: { lte: docDate }
          },
          orderBy: { effectiveDate: 'desc' }
        });
      } catch (apiErr) {
        console.warn(`[LiveRateSyncService] Live API fetch failed on-demand for ${ccyUpper}, falling back to stored rate:`, apiErr.message);
      }
    }

    // If still no rate with effectiveDate <= docDate, check if ANY rate has ever existed for this currency pair
    if (!latestStored) {
      latestStored = await txClient.exchangeRate.findFirst({
        where: {
          fromCurrencyId: foreignCcy.id,
          toCurrencyId: baseCcy.id,
          rateType: 'COMMERCIAL'
        },
        orderBy: { effectiveDate: 'asc' }
      });
    }

    // Strict rule: If no rate has ever existed, block saving! Never default to 1.0!
    if (!latestStored) {
      throw new Error(`No exchange rate for ${ccyUpper}`);
    }

    // Evaluate age warning
    const rateFetchedAt = new Date(latestStored.fetchedAt || latestStored.createdAt);
    const rateEffDate = new Date(latestStored.effectiveDate);
    const rateAgeMs = Math.max(0, now - rateFetchedAt.getTime());
    const rateAgeHours = rateAgeMs / (1000 * 60 * 60);
    const rateAgeDays = rateAgeHours / 24;

    let warningLevel = 'NONE';
    let warningMessage = null;

    if (rateAgeDays > this.redThresholdDays) {
      warningLevel = 'RED';
      warningMessage = `Exchange rate is ${Math.floor(rateAgeDays)} days old (fetched ${rateFetchedAt.toLocaleDateString()}). Please refresh rates before proceeding.`;
    } else if (rateAgeHours > this.amberThresholdHours) {
      warningLevel = 'AMBER';
      warningMessage = `Exchange rate is ${Math.floor(rateAgeHours)} hours old. Consider refreshing to get today's live rate.`;
    }

    return {
      currency: ccyUpper,
      baseCurrency: baseCode,
      rate: Number(latestStored.rate),
      source: latestStored.source || 'API:stored',
      rateType: latestStored.rateType,
      effectiveDate: rateEffDate,
      fetchedAt: rateFetchedAt,
      ageHours: rateAgeHours,
      ageDays: rateAgeDays,
      warningLevel,
      warningMessage
    };
  }

  /**
   * Records a manual Statutory (GST/CBIC/RBI) exchange rate.
   * Kept strictly separate from the market API rate.
   */
  async saveStatutoryRate({ businessId, currencyCode, rate, effectiveDate, source = 'CBIC-Notified', createdBy = null, txClient = prisma }) {
    const ccyUpper = (currencyCode || '').toUpperCase().trim();
    const rateNum = Number(rate);
    if (!rateNum || rateNum <= 0) {
      throw new Error('Valid strictly positive exchange rate is required');
    }

    const business = await txClient.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });

    const baseCode = (business?.baseCurrency?.code || business?.currency || 'INR').toUpperCase();
    let foreignCcy = await txClient.currency.findUnique({ where: { code: ccyUpper } });
    if (!foreignCcy) {
      foreignCcy = await txClient.currency.create({
        data: { code: ccyUpper, name: ccyUpper, symbol: ccyUpper }
      });
    }

    let baseCcy = await txClient.currency.findUnique({ where: { code: baseCode } });
    if (!baseCcy) {
      baseCcy = await txClient.currency.create({
        data: { code: baseCode, name: baseCode, symbol: baseCode === 'INR' ? '₹' : '$' }
      });
    }

    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();
    effDate.setUTCHours(0, 0, 0, 0);

    const record = await txClient.exchangeRate.upsert({
      where: {
        fromCurrencyId_toCurrencyId_effectiveDate_rateType: {
          fromCurrencyId: foreignCcy.id,
          toCurrencyId: baseCcy.id,
          effectiveDate: effDate,
          rateType: 'STATUTORY'
        }
      },
      update: {
        rate: rateNum,
        source: source || 'CBIC-Notified',
        fetchedAt: new Date(),
        createdBy: createdBy || 'MANUAL'
      },
      create: {
        fromCurrencyId: foreignCcy.id,
        toCurrencyId: baseCcy.id,
        rate: rateNum,
        effectiveDate: effDate,
        source: source || 'CBIC-Notified',
        rateType: 'STATUTORY',
        fetchedAt: new Date(),
        createdBy: createdBy || 'MANUAL'
      }
    });

    return record;
  }
}

const liveRateSyncService = new LiveRateSyncService();

module.exports = {
  LiveRateSyncService,
  liveRateSyncService
};
