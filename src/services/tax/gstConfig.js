/**
 * Statutory GST Rate Slabs & Indian GST State Master (CBIC Date-Aware)
 * 
 * Rules:
 * - 0, 0.1, 0.25, 1.5, 3, 5, 18 are ALWAYS valid.
 * - 12 and 28 are valid ONLY for documents dated before 2025-09-22.
 * - 40 is valid ONLY for documents dated on or after 2025-09-22.
 */

const GST_RATE_ENTRIES = [
  { rate: 0, effectiveFrom: null, effectiveTo: null, label: 'Nil Rated (0%)' },
  { rate: 0.1, effectiveFrom: null, effectiveTo: null, label: 'Precious Stones (0.1%)' },
  { rate: 0.25, effectiveFrom: null, effectiveTo: null, label: 'Rough Diamonds (0.25%)' },
  { rate: 1.5, effectiveFrom: null, effectiveTo: null, label: 'Job Work / Cut Diamonds (1.5%)' },
  { rate: 3, effectiveFrom: null, effectiveTo: null, label: 'Gold & Silver (3%)' },
  { rate: 5, effectiveFrom: null, effectiveTo: null, label: 'Concessional Goods & Services (5%)' },
  { rate: 18, effectiveFrom: null, effectiveTo: null, label: 'Standard Rate (18%)' },
  { rate: 12, effectiveFrom: null, effectiveTo: new Date('2025-09-22T00:00:00.000Z'), label: 'Pre-2025 Slab (12%)' },
  { rate: 28, effectiveFrom: null, effectiveTo: new Date('2025-09-22T00:00:00.000Z'), label: 'Pre-2025 Luxury/Sin Slab (28%)' },
  { rate: 40, effectiveFrom: new Date('2025-09-22T00:00:00.000Z'), effectiveTo: null, label: 'Post-2025 Special/Sin Slab (40%)' }
];

function getValidGstRatesForDate(docDate) {
  const d = docDate ? new Date(docDate) : new Date();
  const validRates = new Set();
  for (const entry of GST_RATE_ENTRIES) {
    const afterStart = !entry.effectiveFrom || d >= entry.effectiveFrom;
    const beforeEnd = !entry.effectiveTo || d < entry.effectiveTo;
    if (afterStart && beforeEnd) {
      validRates.add(entry.rate);
    }
  }
  return validRates;
}

function isValidGstRate(rate, docDate) {
  const numRate = Number(rate);
  const validSet = getValidGstRatesForDate(docDate);
  return validSet.has(numRate);
}

/**
 * 36 Indian States & Union Territories with statutory 2-digit GST state codes
 */
const GST_STATES = [
  { code: '01', name: 'Jammu and Kashmir', short: 'JK' },
  { code: '02', name: 'Himachal Pradesh', short: 'HP' },
  { code: '03', name: 'Punjab', short: 'PB' },
  { code: '04', name: 'Chandigarh', short: 'CH' },
  { code: '05', name: 'Uttarakhand', short: 'UK', aliases: ['UA', 'UTTARANCHAL'] },
  { code: '06', name: 'Haryana', short: 'HR' },
  { code: '07', name: 'Delhi', short: 'DL' },
  { code: '08', name: 'Rajasthan', short: 'RJ' },
  { code: '09', name: 'Uttar Pradesh', short: 'UP' },
  { code: '10', name: 'Bihar', short: 'BR' },
  { code: '11', name: 'Sikkim', short: 'SK' },
  { code: '12', name: 'Arunachal Pradesh', short: 'AR' },
  { code: '13', name: 'Nagaland', short: 'NL' },
  { code: '14', name: 'Manipur', short: 'MN' },
  { code: '15', name: 'Mizoram', short: 'MZ' },
  { code: '16', name: 'Tripura', short: 'TR' },
  { code: '17', name: 'Meghalaya', short: 'ML' },
  { code: '18', name: 'Assam', short: 'AS' },
  { code: '19', name: 'West Bengal', short: 'WB' },
  { code: '20', name: 'Jharkhand', short: 'JH' },
  { code: '21', name: 'Odisha', short: 'OD', aliases: ['OR', 'ORISSA'] },
  { code: '22', name: 'Chhattisgarh', short: 'CG', aliases: ['CT'] },
  { code: '23', name: 'Madhya Pradesh', short: 'MP' },
  { code: '24', name: 'Gujarat', short: 'GJ' },
  { code: '25', name: 'Daman and Diu (Legacy)', short: 'DD' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', short: 'DNHDD', aliases: ['DADRA AND NAGAR HAVELI', 'DAMAN AND DIU'] },
  { code: '27', name: 'Maharashtra', short: 'MH' },
  { code: '29', name: 'Karnataka', short: 'KA' },
  { code: '30', name: 'Goa', short: 'GA' },
  { code: '31', name: 'Lakshadweep', short: 'LD' },
  { code: '32', name: 'Kerala', short: 'KL' },
  { code: '33', name: 'Tamil Nadu', short: 'TN' },
  { code: '34', name: 'Puducherry', short: 'PY', aliases: ['PONDICHERRY'] },
  { code: '35', name: 'Andaman and Nicobar Islands', short: 'AN' },
  { code: '36', name: 'Telangana', short: 'TS', aliases: ['TG'] },
  { code: '37', name: 'Andhra Pradesh', short: 'AP' },
  { code: '38', name: 'Ladakh', short: 'LA' },
  { code: '97', name: 'Other Territory', short: 'OT' }
];

// Build fast lookup index
const STATE_LOOKUP_MAP = new Map();

for (const state of GST_STATES) {
  // Code mapping (e.g. '24' -> state)
  STATE_LOOKUP_MAP.set(state.code, state);
  // Numeric code string without leading zero (e.g. '7' -> '07')
  if (state.code.startsWith('0')) {
    STATE_LOOKUP_MAP.set(String(parseInt(state.code, 10)), state);
  }
  // Short code (e.g. 'GJ' -> state)
  STATE_LOOKUP_MAP.set(state.short.toUpperCase(), state);
  // Name normalized
  STATE_LOOKUP_MAP.set(state.name.toUpperCase().replace(/[^A-Z0-9]/g, ''), state);

  if (state.aliases) {
    for (const alias of state.aliases) {
      STATE_LOOKUP_MAP.set(alias.toUpperCase().replace(/[^A-Z0-9]/g, ''), state);
    }
  }
}

/**
 * Resolves a state input (name, code, abbreviation) to its canonical GST state master entry.
 * Examples:
 *   resolveGstState("Gujarat") -> { code: '24', name: 'Gujarat', short: 'GJ' }
 *   resolveGstState("gujarat ") -> { code: '24', name: 'Gujarat', short: 'GJ' }
 *   resolveGstState("GJ") -> { code: '24', ... }
 *   resolveGstState("24") -> { code: '24', ... }
 *   resolveGstState(24) -> { code: '24', ... }
 */
function resolveGstState(input) {
  if (!input) return null;
  const str = String(input).trim().toUpperCase();
  if (!str) return null;

  // Direct match in lookup map
  if (STATE_LOOKUP_MAP.has(str)) {
    return STATE_LOOKUP_MAP.get(str);
  }

  // Cleaned alphanumeric match
  const cleaned = str.replace(/[^A-Z0-9]/g, '');
  if (STATE_LOOKUP_MAP.has(cleaned)) {
    return STATE_LOOKUP_MAP.get(cleaned);
  }

  // 2-digit pad
  if (/^\d{1,2}$/.test(cleaned)) {
    const padded = cleaned.padStart(2, '0');
    if (STATE_LOOKUP_MAP.has(padded)) {
      return STATE_LOOKUP_MAP.get(padded);
    }
  }

  return null;
}

function resolveGstStateCode(input) {
  const match = resolveGstState(input);
  return match ? match.code : null;
}

/**
 * Validates a GSTIN string format (15 characters)
 * 2 digits state code + 10 chars PAN + 1 entity digit + 'Z' + 1 checksum digit
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function isValidGstinFormat(gstin) {
  if (!gstin) return false;
  return GSTIN_REGEX.test(String(gstin).trim().toUpperCase());
}

/**
 * Validates GSTIN prefix (first two digits) against statutory state code.
 */
function validateGstinPrefix(gstin, stateInput) {
  if (!gstin) return { valid: true };
  const cleanGstin = String(gstin).trim().toUpperCase();
  if (cleanGstin.length < 2) return { valid: false, error: 'GSTIN is too short' };

  const gstinStateCode = cleanGstin.slice(0, 2);
  const stateMaster = resolveGstState(stateInput);

  if (!stateMaster) {
    return {
      valid: false,
      error: `State "${stateInput}" could not be resolved in the statutory GST state master.`
    };
  }

  if (gstinStateCode !== stateMaster.code) {
    return {
      valid: false,
      error: `GSTIN prefix (${gstinStateCode}) does not match registered state ${stateMaster.name} (${stateMaster.code}).`
    };
  }

  return { valid: true, stateMaster, gstinStateCode };
}

module.exports = {
  GST_RATE_ENTRIES,
  getValidGstRatesForDate,
  isValidGstRate,
  GST_STATES,
  resolveGstState,
  resolveGstStateCode,
  isValidGstinFormat,
  validateGstinPrefix
};
