const crypto = require('crypto');

// Secret key for AES-256-GCM encryption
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'que-erp-default-secure-salt-2026')
  .digest();

/**
 * Encrypts sensitive bank account numbers using AES-256-GCM
 */
function encryptAccountNumber(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts sensitive bank account numbers
 */
function decryptAccountNumber(cipherText) {
  if (!cipherText || !cipherText.includes(':')) return cipherText;
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '••••••••';
  }
}

/**
 * Masks account number to show only the last 4 digits
 */
function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '';
  const clean = String(accountNumber).trim();
  if (clean.length <= 4) return '••••' + clean;
  const last4 = clean.slice(-4);
  return '••••••••' + last4;
}

/**
 * Standard ISO 7064 Mod 97-10 IBAN Validation
 */
function validateIban(iban) {
  if (!iban) return false;
  const clean = String(iban).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 15 || clean.length > 34) return false;

  // Move first 4 characters to end
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numeric = '';
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numeric += String(code - 55);
    } else {
      numeric += rearranged[i];
    }
  }

  // Mod-97 using chunking for big numbers
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.substring(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }

  return remainder === 1;
}

/**
 * US ABA Routing Transit Number Checksum Validation
 * Weight formula: (3*(d1+d4+d7) + 7*(d2+d5+d8) + 1*(d3+d6+d9)) % 10 === 0
 */
function validateAbaRouting(routing) {
  if (!routing) return false;
  const clean = String(routing).trim();
  if (!/^\d{9}$/.test(clean)) return false;

  const d = clean.split('').map(Number);
  const checksum = (
    3 * (d[0] + d[3] + d[6]) +
    7 * (d[1] + d[4] + d[7]) +
    1 * (d[2] + d[5] + d[8])
  ) % 10;

  return checksum === 0;
}

/**
 * Validate SWIFT / BIC Code (8 or 11 alphanumeric characters)
 */
function validateSwift(swift) {
  if (!swift) return false;
  const clean = String(swift).trim().toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(clean);
}

/**
 * Validate India IFSC (4 letters, 0, 6 alphanumeric)
 */
function validateIfsc(ifsc) {
  if (!ifsc) return false;
  const clean = String(ifsc).trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean);
}

/**
 * Validate India GSTIN
 */
function validateGstin(gstin) {
  if (!gstin) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(gstin).trim().toUpperCase());
}

/**
 * Validate UAE TRN (15 digits, starting with 100)
 */
function validateUaeTrn(trn) {
  if (!trn) return false;
  const clean = String(trn).trim();
  return /^100\d{12}$/.test(clean) || (/^\d{15}$/.test(clean) && clean.startsWith('100'));
}
function normalizeBankCountry(countryCode) {
  if (!countryCode) return '';
  const c = String(countryCode).toUpperCase().trim();
  if (['IN', 'IND', 'INDIA'].includes(c)) return 'INDIA';
  if (['AE', 'ARE', 'UAE', 'UNITED ARAB EMIRATES'].includes(c) || c.includes('EMIRATES')) return 'UAE';
  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(c) || c.includes('UNITED STATES')) return 'USA';
  if (['GB', 'GBR', 'UK', 'UNITED KINGDOM'].includes(c) || c.includes('KINGDOM')) return 'UK';
  if (['CA', 'CAN', 'CANADA'].includes(c)) return 'CANADA';
  if (['AU', 'AUS', 'AUSTRALIA'].includes(c)) return 'AUSTRALIA';
  return c;
}

/**
 * Validates a Customer Bank Account against country rules
 */
function validateCustomerBank(accountData, countryCode) {
  const country = normalizeBankCountry(countryCode || accountData.country);
  const errors = [];

  if (!accountData.accountHolderName || !accountData.accountHolderName.trim()) {
    errors.push('Account holder name is required.');
  }
  if (!accountData.bankName || !accountData.bankName.trim()) {
    errors.push('Bank name is required.');
  }

  const rawAccount = String(
    accountData.accountNumber || accountData.accountNumberPlain || accountData.iban || ''
  ).trim();

  if (!rawAccount) {
    errors.push('Account number or IBAN is required.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  encryptAccountNumber,
  decryptAccountNumber,
  maskAccountNumber,
  validateIban,
  validateAbaRouting,
  validateSwift,
  validateIfsc,
  validateGstin,
  validateUaeTrn,
  validateCustomerBank
};
