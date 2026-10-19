/**
 * Rate Provider Abstraction for Foreign Exchange Rates
 * 
 * Supports swappable providers via RATE_PROVIDER and RATE_API_KEY environment variables.
 * Default provider: open.er-api.com (free, reliable, no API key required).
 * 
 * Returns base currency (e.g. INR) per 1 unit of foreign currency (e.g. 1 USD = 83.50 INR, 1 CAD = 60.20 INR).
 */

const axios = require('axios');

class RateProviderError extends Error {
  constructor(message, originalError = null, statusCode = 502) {
    super(message);
    this.name = 'RateProviderError';
    this.originalError = originalError;
    this.statusCode = statusCode;
  }
}

/**
 * Base Rate Provider Interface
 */
class BaseRateProvider {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
  }

  async fetchRates(baseCurrency, targetCurrencies = []) {
    throw new Error('fetchRates must be implemented by adapter subclass');
  }
}

/**
 * Open Exchange Rates / open.er-api.com Free Adapter
 * Default provider requiring no API key.
 */
class OpenErApiProvider extends BaseRateProvider {
  constructor(options = {}) {
    super('open.er-api.com', options);
    this.baseUrl = options.baseUrl || 'https://open.er-api.com/v6/latest';
    this.timeout = options.timeout || 8000;
  }

  async fetchRates(baseCurrency, targetCurrencies = []) {
    const baseCcy = (baseCurrency || 'INR').toUpperCase().trim();
    const url = `${this.baseUrl}/${encodeURIComponent(baseCcy)}`;

    let lastError = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'QueERP-FX-Service/1.0'
          }
        });

        const data = response.data;
        if (!data || data.result !== 'success' || !data.rates) {
          throw new RateProviderError(`Invalid response structure from open.er-api.com: ${JSON.stringify(data)}`);
        }

        const rawRates = data.rates;
        const normalizedRates = {};

        // For open.er-api with base = baseCcy (e.g. INR):
        // rawRates[CCY] is the amount of foreign currency per 1 base unit (e.g. 0.012 USD per 1 INR).
        // The business requires: "Return INR per 1 unit for every currency" (1 USD = 83.50 INR).
        // Therefore: rate = 1 / rawRates[CCY]
        for (const [ccy, foreignPerBase] of Object.entries(rawRates)) {
          const upperCcy = ccy.toUpperCase();
          const numForeign = Number(foreignPerBase);

          if (upperCcy === baseCcy) {
            normalizedRates[upperCcy] = 1.0;
          } else if (numForeign > 0) {
            // Foreign currency to Base currency rate: 1 unit of foreign = (1 / foreignPerBase) base units
            const rateInBase = 1 / numForeign;
            normalizedRates[upperCcy] = Math.round(rateInBase * 1000000) / 1000000; // 6 decimal precision
          }
        }

        const fetchedAt = new Date();
        const effectiveDate = new Date();
        effectiveDate.setUTCHours(0, 0, 0, 0);

        return {
          provider: this.name,
          source: `API:${this.name}`,
          baseCurrency: baseCcy,
          fetchedAt,
          effectiveDate,
          rates: normalizedRates,
          rawResponse: {
            time_last_update_utc: data.time_last_update_utc,
            provider: data.provider
          }
        };
      } catch (err) {
        lastError = err;
        // Wait 300ms before retrying on network/timeout errors
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
    }

    throw new RateProviderError(
      `Failed to fetch live exchange rates from ${this.name} after ${maxRetries + 1} attempts: ${lastError?.message}`,
      lastError
    );
  }
}

/**
 * Generic ExchangeRate-API (Authenticated) Adapter
 * Used when RATE_PROVIDER=exchangerate-api or when an API key is provided
 */
class ExchangeRateApiProvider extends BaseRateProvider {
  constructor(apiKey, options = {}) {
    super('exchangerate-api.com', options);
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://v6.exchangerate-api.com/v6';
    this.timeout = options.timeout || 8000;
  }

  async fetchRates(baseCurrency, targetCurrencies = []) {
    const baseCcy = (baseCurrency || 'INR').toUpperCase().trim();
    if (!this.apiKey) {
      throw new RateProviderError('RATE_API_KEY is required for exchangerate-api.com provider');
    }
    const url = `${this.baseUrl}/${encodeURIComponent(this.apiKey)}/latest/${encodeURIComponent(baseCcy)}`;

    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: { 'Accept': 'application/json' }
      });
      const data = response.data;
      if (!data || data.result !== 'success' || !data.conversion_rates) {
        throw new RateProviderError(`Invalid response from exchangerate-api.com: ${JSON.stringify(data)}`);
      }

      const normalizedRates = {};
      for (const [ccy, foreignPerBase] of Object.entries(data.conversion_rates)) {
        const upperCcy = ccy.toUpperCase();
        const numForeign = Number(foreignPerBase);
        if (upperCcy === baseCcy) {
          normalizedRates[upperCcy] = 1.0;
        } else if (numForeign > 0) {
          normalizedRates[upperCcy] = Math.round((1 / numForeign) * 1000000) / 1000000;
        }
      }

      const fetchedAt = new Date();
      const effectiveDate = new Date();
      effectiveDate.setUTCHours(0, 0, 0, 0);

      return {
        provider: this.name,
        source: `API:${this.name}`,
        baseCurrency: baseCcy,
        fetchedAt,
        effectiveDate,
        rates: normalizedRates
      };
    } catch (err) {
      throw new RateProviderError(`Failed to fetch rates from exchangerate-api.com: ${err.message}`, err);
    }
  }
}

/**
 * Rate Provider Service with In-Memory Response Caching
 */
class RateProviderService {
  constructor(customProvider = null) {
    this.activeProvider = customProvider;
    this.cache = new Map(); // key: baseCurrency -> { timestamp, data }
    this.cacheTtlMs = parseInt(process.env.RATE_CACHE_TTL_MS, 10) || 3600000; // 1 hour default
  }

  getProvider() {
    if (this.activeProvider) {
      return this.activeProvider;
    }

    const providerType = (process.env.RATE_PROVIDER || 'open.er-api').toLowerCase().trim();
    const apiKey = process.env.RATE_API_KEY;

    if (providerType === 'exchangerate-api' && apiKey) {
      return new ExchangeRateApiProvider(apiKey);
    }

    // Default to free open.er-api.com
    return new OpenErApiProvider();
  }

  setProvider(providerInstance) {
    this.activeProvider = providerInstance;
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Fetches exchange rates with caching.
   * 
   * @param {string} baseCurrency (e.g. "INR")
   * @param {string[]} [targetCurrencies=[]] (e.g. ["USD", "CAD", "AED"])
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{ provider, source, baseCurrency, fetchedAt, effectiveDate, rates }>}
   */
  async getRates(baseCurrency = 'INR', targetCurrencies = [], forceRefresh = false) {
    const baseCcy = (baseCurrency || 'INR').toUpperCase().trim();
    const cacheKey = `${baseCcy}`;
    const now = Date.now();

    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (now - cached.timestamp < this.cacheTtlMs) {
        return cached.data;
      }
    }

    const provider = this.getProvider();
    const rateData = await provider.fetchRates(baseCcy, targetCurrencies);

    this.cache.set(cacheKey, {
      timestamp: now,
      data: rateData
    });

    return rateData;
  }
}

const rateProviderService = new RateProviderService();

module.exports = {
  RateProviderService,
  rateProviderService,
  BaseRateProvider,
  OpenErApiProvider,
  ExchangeRateApiProvider,
  RateProviderError
};
