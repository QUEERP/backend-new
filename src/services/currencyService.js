const prisma = require('../config/prisma');
const { roundHalfUp, getCurrencyDecimals } = require('./currencyFxService');

class RateResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateResolutionError';
    this.statusCode = 400; // Easily catchable by controllers
  }
}

class CurrencyService {
  /**
   * Resolves transaction and base currency info, fetching commercial and statutory exchange rates.
   * Throws validation errors if required rates are missing.
   * 
   * @param {string} businessId 
   * @param {string} transactionCurrencyCode (e.g. "USD", "EUR")
   * @param {Date} transactionDate 
   * @returns {Promise<{ transactionCurrencyId, baseCurrencyId, exchangeRate, statutoryRate, decimals, baseDecimals }>}
   */
  static async resolveCurrencyData(businessId, transactionCurrencyCode, transactionDate = new Date(), txClient = prisma) {
    // 1. Fetch Business with its Base Currency and Country
    const business = await txClient.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true, countryRef: true }
    });

    if (!business || !business.baseCurrencyId) {
      throw new RateResolutionError(`Business missing base currency setup. ID: ${businessId}`);
    }

    const baseCurrencyId = business.baseCurrencyId;
    const baseCurrencyCode = business.baseCurrency?.code || business.currency || 'INR';
    const baseDecimals = business.baseCurrency?.decimals !== undefined
      ? business.baseCurrency.decimals
      : getCurrencyDecimals(baseCurrencyCode);

    const normalizedCurrencyCode = (transactionCurrencyCode || '').trim().toUpperCase();

    // 2. Fetch Transaction Currency by Code (Auto-provision standard ISO currencies if missing)
    let transactionCurrency = await txClient.currency.findUnique({
      where: { code: normalizedCurrencyCode }
    });

    if (!transactionCurrency && normalizedCurrencyCode.length === 3) {
      try {
        const { STANDARD_CURRENCIES } = require('../../prisma/seedCurrencies');
        const standard = STANDARD_CURRENCIES.find(c => c.code === normalizedCurrencyCode);
        const dec = standard ? standard.decimals : getCurrencyDecimals(normalizedCurrencyCode);
        const sym = standard ? standard.symbol : normalizedCurrencyCode;
        const nm = standard ? standard.name : normalizedCurrencyCode;

        transactionCurrency = await txClient.currency.upsert({
          where: { code: normalizedCurrencyCode },
          update: {},
          create: {
            code: normalizedCurrencyCode,
            name: nm,
            symbol: sym,
            decimals: dec,
            decimalPrecision: dec
          }
        });
      } catch (upsertErr) {
        transactionCurrency = await txClient.currency.findUnique({
          where: { code: normalizedCurrencyCode }
        });
      }
    }

    if (!transactionCurrency) {
      throw new RateResolutionError(`Unsupported or unknown currency code: "${transactionCurrencyCode}". Currencies must be configured in system currency master before use.`);
    }

    const transactionCurrencyId = transactionCurrency.id;
    const decimals = transactionCurrency.decimals !== undefined ? transactionCurrency.decimals : getCurrencyDecimals(transactionCurrencyCode);

    // 3. Same Currency Fast-Path
    if (transactionCurrencyId === baseCurrencyId) {
      return {
        transactionCurrencyId,
        baseCurrencyId,
        exchangeRate: 1.0,
        statutoryRate: 1.0,
        decimals,
        baseDecimals
      };
    }

    // 4. Cross Currency - Fetch ExchangeRateRule for Business Country + Base Currency
    let rule = null;
    if (business.countryId) {
      rule = await txClient.exchangeRateRule.findUnique({
        where: {
          countryId_baseCurrencyId: {
            countryId: business.countryId,
            baseCurrencyId: baseCurrencyId
          }
        }
      });
    }

    const requiresStatutoryRate = rule?.requiresStatutoryRate || false;
    const statutoryRateSource = rule?.statutoryRateSource || null;

    // 5. Fetch Commercial Exchange Rate via liveRateSyncService (with on-demand live fallback, age warnings, and strict blocking)
    const { liveRateSyncService } = require('./fx/liveRateSyncService');
    let resolvedRateData;
    try {
      resolvedRateData = await liveRateSyncService.resolveCommercialRate(businessId, transactionCurrencyCode, transactionDate, txClient);
    } catch (err) {
      if (err.message && err.message.includes('No exchange rate for')) {
        throw new RateResolutionError(err.message);
      }
      throw new RateResolutionError(`Failed to resolve exchange rate for ${transactionCurrencyCode}: ${err.message}`);
    }

    const exchangeRate = resolvedRateData.rate;
    let statutoryRate = exchangeRate;

    // 6. Fetch Statutory Exchange Rate (if mandated by the country, strictly separate from commercial API)
    if (requiresStatutoryRate) {
      const statutoryRateRecord = await txClient.exchangeRate.findFirst({
        where: {
          fromCurrencyId: transactionCurrencyId,
          toCurrencyId: baseCurrencyId,
          effectiveDate: { lte: transactionDate },
          rateType: 'STATUTORY',
          ...(statutoryRateSource ? { source: statutoryRateSource } : {})
        },
        orderBy: { effectiveDate: 'desc' }
      });

      if (!statutoryRateRecord) {
        throw new RateResolutionError(`Missing STATUTORY exchange rate for ${transactionCurrencyCode} -> ${business.baseCurrency?.code || business.currency || 'INR'} (Source: ${statutoryRateSource || 'ANY'}) on or before ${transactionDate.toISOString()}`);
      }
      
      statutoryRate = statutoryRateRecord.rate;
    }

    return {
      transactionCurrencyId,
      baseCurrencyId,
      exchangeRate,
      statutoryRate,
      source: resolvedRateData.source,
      fetchedAt: resolvedRateData.fetchedAt,
      effectiveDate: resolvedRateData.effectiveDate,
      warningLevel: resolvedRateData.warningLevel,
      warningMessage: resolvedRateData.warningMessage,
      decimals,
      baseDecimals
    };
  }

  /**
   * Helper to scale an amount using the exchange rate and rounding correctly.
   * Standardized to use roundHalfUp on integer minor units (paise/cents).
   * Strictly enforces positive non-zero exchange rate and valid numeric amounts.
   */
  static scaleAmount(amountTxn, rate, decimals = 2) {
    if (amountTxn === undefined || amountTxn === null || isNaN(Number(amountTxn))) {
      throw new Error(`Invalid transaction amount: ${amountTxn}`);
    }
    const rateNum = Number(rate);
    if (rate === undefined || rate === null || isNaN(rateNum) || rateNum <= 0) {
      throw new Error(`Invalid exchange rate: ${rate}. Exchange rate must be a strictly positive number greater than 0.`);
    }
    const numAmount = Number(amountTxn);
    const scaled = numAmount * rateNum;
    return roundHalfUp(scaled, decimals);
  }
}

module.exports = { CurrencyService, RateResolutionError };
