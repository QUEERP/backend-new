const prisma = require('../config/prisma');

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
   * @returns {Promise<{ transactionCurrencyId, baseCurrencyId, exchangeRate, statutoryRate, decimals }>}
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

    // 2. Fetch Transaction Currency by Code
    const transactionCurrency = await prisma.currency.findUnique({
      where: { code: transactionCurrencyCode }
    });

    if (!transactionCurrency) {
      throw new RateResolutionError(`Unmappable transaction currency code: ${transactionCurrencyCode}`);
    }

    const transactionCurrencyId = transactionCurrency.id;
    const decimals = transactionCurrency.decimals || 2;

    // 3. Same Currency Fast-Path
    if (transactionCurrencyId === baseCurrencyId) {
      return {
        transactionCurrencyId,
        baseCurrencyId,
        exchangeRate: 1.0,
        statutoryRate: 1.0,
        decimals
      };
    }

    // 4. Cross Currency - Fetch ExchangeRateRule for Business Country + Base Currency
    let rule = null;
    if (business.countryId) {
      rule = await prisma.exchangeRateRule.findUnique({
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

    // 5. Fetch Commercial Exchange Rate
    const commercialRateRecord = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrencyId: transactionCurrencyId,
        toCurrencyId: baseCurrencyId,
        effectiveDate: { lte: transactionDate },
        rateType: 'COMMERCIAL'
      },
      orderBy: { effectiveDate: 'desc' }
    });

    if (!commercialRateRecord) {
      throw new RateResolutionError(`Missing COMMERCIAL exchange rate for ${transactionCurrencyCode} -> ${business.baseCurrency.code} on or before ${transactionDate.toISOString()}`);
    }

    let statutoryRate = commercialRateRecord.rate;

    // 6. Fetch Statutory Exchange Rate (if mandated by the country)
    if (requiresStatutoryRate) {
      const statutoryRateRecord = await prisma.exchangeRate.findFirst({
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
        throw new RateResolutionError(`Missing STATUTORY exchange rate for ${transactionCurrencyCode} -> ${business.baseCurrency.code} (Source: ${statutoryRateSource || 'ANY'}) on or before ${transactionDate.toISOString()}`);
      }
      
      statutoryRate = statutoryRateRecord.rate;
    }

    return {
      transactionCurrencyId,
      baseCurrencyId,
      exchangeRate: commercialRateRecord.rate,
      statutoryRate,
      decimals
    };
  }

  /**
   * Helper to scale an amount using the exchange rate and rounding correctly.
   */
  static scaleAmount(amountTxn, rate, decimals = 2) {
    if (!amountTxn) return 0;
    const scaled = amountTxn * rate;
    return Number(scaled.toFixed(decimals));
  }
}

module.exports = { CurrencyService, RateResolutionError };
