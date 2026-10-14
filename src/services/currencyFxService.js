/**
 * Currency FX Calculation Service
 * 
 * Provides mathematically exact Realized and Unrealized Foreign Exchange
 * gain/loss calculations in integer minor units (paise/cents).
 * 
 * Formulas:
 * 1. Realized FX (Receivable - Invoice / Customer Payment):
 *    gainLoss = (settlement_rate - booking_rate) * foreign_amount_settled
 *    gain: gainLoss > 0, loss: gainLoss < 0
 * 
 * 2. Realized FX (Payable - Bill / Vendor Payment):
 *    gainLoss = (booking_rate - settlement_rate) * foreign_amount_settled
 *    gain: gainLoss > 0, loss: gainLoss < 0 (opposite sign to receivable)
 * 
 * 3. Unrealized FX (Open Receivables):
 *    gainLoss = (latest_rate - booking_rate) * open_foreign_amount
 * 
 * 4. Unrealized FX (Open Payables):
 *    gainLoss = (booking_rate - latest_rate) * open_foreign_amount
 */

/**
 * ISO 4217 Per-Currency Minor-Unit Exponents
 * Default is 2 minor units (paise/cents).
 */
const CURRENCY_EXPONENTS = {
  // 0 Decimals (Zero-minor-unit currencies)
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, JPY: 0, KMF: 0, KRW: 0, MGA: 0,
  PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // 3 Decimals (Three-minor-unit currencies)
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // 4 Decimals
  CLF: 4, UYW: 4,
  // Standard 2 Decimals (INR, USD, EUR, AED, GBP, CAD, AUD, SAR, QAR, SGD, etc.)
};

/**
 * Returns the minor-unit exponent (decimals) for a given currency code.
 * Defaults to 2 if unspecified or unknown.
 */
function getCurrencyDecimals(currencyCode) {
  if (!currencyCode) return 2;
  const code = String(currencyCode).toUpperCase().trim();
  return CURRENCY_EXPONENTS[code] !== undefined ? CURRENCY_EXPONENTS[code] : 2;
}

/**
 * Standard Half-Up Rounding Rule for financial and base-currency calculations:
 * Ties round away from zero for midpoints (e.g. 1.005 -> 1.01).
 * Uses Number.EPSILON to avoid binary floating-point representation rounding errors.
 */
function roundHalfUp(amount, decimals = 2) {
  const num = Number(amount) || 0;
  const factor = Math.pow(10, decimals);
  const sign = num < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(num) + Number.EPSILON) * factor) / factor);
}

/**
 * Converts standard amount to integer minor units (paise/cents).
 */
function toMinorUnits(amount, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(amount) || 0) * factor);
}

/**
 * Converts integer minor units back to standard float amount rounded to decimals.
 */
function fromMinorUnits(units, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return roundHalfUp((units || 0) / factor, decimals);
}

/**
 * Multiplies an amount in minor units by an exchange rate and returns base minor units.
 */
function convertToMinorBase(nominalMinorUnits, exchangeRate) {
  const rate = Number(exchangeRate) || 1;
  return Math.round(nominalMinorUnits * rate);
}

/**
 * Calculates Realized FX for a single settlement.
 * 
 * @param {Object} params
 * @param {'RECEIVABLE'|'PAYABLE'} params.type
 * @param {number} params.bookingRate - Exchange rate on document creation (invoice/bill)
 * @param {number} params.settlementRate - Exchange rate on payment settlement
 * @param {number} params.foreignAmountSettled - Settled amount in foreign currency
 * @param {number} [params.decimals=2] - Currency decimals
 * @returns {Object} { realizedGainLoss, realizedGain, realizedLoss, isGain, isLoss }
 */
function calculateRealizedFx({
  type,
  bookingRate,
  settlementRate,
  foreignAmountSettled,
  decimals = 2
}) {
  const amount = Number(foreignAmountSettled) || 0;
  const bRate = Number(bookingRate) || 1;
  const sRate = Number(settlementRate) || 1;

  if (amount <= 0) {
    return {
      realizedGainLoss: 0,
      realizedGain: 0,
      realizedLoss: 0,
      isGain: false,
      isLoss: false
    };
  }

  // Calculate in integer minor units
  // Receivable: (sRate - bRate) * amount
  // Payable:    (bRate - sRate) * amount
  const rateDiff = type === 'RECEIVABLE' ? (sRate - bRate) : (bRate - sRate);
  
  // Math in integer minor units to eliminate floating-point inaccuracies
  const foreignMinor = toMinorUnits(amount, decimals);
  // (foreignMinor * rateDiff) yields baseMinorUnits directly
  const baseMinorDiff = Math.round(foreignMinor * rateDiff);
  const netGainLoss = fromMinorUnits(baseMinorDiff, decimals);

  const realizedGain = netGainLoss > 0 ? netGainLoss : 0;
  const realizedLoss = netGainLoss < 0 ? Math.abs(netGainLoss) : 0;

  return {
    realizedGainLoss: netGainLoss,
    realizedGain,
    realizedLoss,
    isGain: netGainLoss > 0,
    isLoss: netGainLoss < 0
  };
}

/**
 * Calculates Unrealized FX for an open balance revalued at the latest rate.
 * 
 * @param {Object} params
 * @param {'RECEIVABLE'|'PAYABLE'} params.type
 * @param {number} params.bookingRate - Original document booking rate
 * @param {number} params.latestRate - Latest/current market exchange rate
 * @param {number} params.openForeignAmount - Outstanding balance in foreign currency
 * @param {number} [params.decimals=2]
 * @returns {Object} { unrealizedGainLoss, unrealizedGain, unrealizedLoss, isGain, isLoss }
 */
function calculateUnrealizedFx({
  type,
  bookingRate,
  latestRate,
  openForeignAmount,
  decimals = 2
}) {
  const amount = Number(openForeignAmount) || 0;
  const bRate = Number(bookingRate) || 1;
  const lRate = Number(latestRate) || 1;

  if (amount <= 0) {
    return {
      unrealizedGainLoss: 0,
      unrealizedGain: 0,
      unrealizedLoss: 0,
      isGain: false,
      isLoss: false
    };
  }

  const rateDiff = type === 'RECEIVABLE' ? (lRate - bRate) : (bRate - lRate);
  const foreignMinor = toMinorUnits(amount, decimals);
  const baseMinorDiff = Math.round(foreignMinor * rateDiff);
  const netGainLoss = fromMinorUnits(baseMinorDiff, decimals);

  return {
    unrealizedGainLoss: netGainLoss,
    unrealizedGain: netGainLoss > 0 ? netGainLoss : 0,
    unrealizedLoss: netGainLoss < 0 ? Math.abs(netGainLoss) : 0,
    isGain: netGainLoss > 0,
    isLoss: netGainLoss < 0
  };
}

module.exports = {
  CURRENCY_EXPONENTS,
  getCurrencyDecimals,
  roundHalfUp,
  toMinorUnits,
  fromMinorUnits,
  convertToMinorBase,
  calculateRealizedFx,
  calculateUnrealizedFx
};
