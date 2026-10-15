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

/**
 * Validates a Customer Bank Account against country rules
 */
function validateCustomerBank(accountData, countryCode) {
  const country = String(countryCode || accountData.country || '').toUpperCase().trim();
  const errors = [];

  if (!accountData.accountHolderName || !accountData.accountHolderName.trim()) {
    errors.push('Account holder name is required.');
  }
  if (!accountData.bankName || !accountData.bankName.trim()) {
    errors.push('Bank name is required.');
  }

  const rawAccount = accountData.accountNumber || accountData.accountNumberPlain;

  switch (country) {
    case 'IN':
    case 'INDIA': {
      if (!rawAccount || !/^\d{9,18}$/.test(String(rawAccount).trim())) {
        errors.push('Indian bank account number must be between 9 and 18 digits.');
      }
      if (!accountData.ifsc || !validateIfsc(accountData.ifsc)) {
        errors.push('Valid IFSC code is required for Indian accounts (Format: 4 letters, 0, 6 characters, e.g. HDFC0001234).');
      }
      break;
    }
    case 'AE':
    case 'ARE':
    case 'UAE': {
      const iban = accountData.iban || rawAccount;
      if (!iban || !String(iban).toUpperCase().startsWith('AE') || String(iban).replace(/\s/g, '').length !== 23) {
        errors.push('UAE IBAN must be 23 characters starting with "AE".');
      } else if (!validateIban(iban)) {
        errors.push('Invalid UAE IBAN checksum (Failed Mod-97 verification).');
      }
      if (accountData.swift && !validateSwift(accountData.swift)) {
        errors.push('Invalid SWIFT/BIC code.');
      }
      break;
    }
    case 'US':
    case 'USA': {
      if (!accountData.routingNumber || !validateAbaRouting(accountData.routingNumber)) {
        errors.push('Valid 9-digit US ABA routing number with correct checksum is required.');
      }
      if (!rawAccount || !/^\d{4,17}$/.test(String(rawAccount).trim())) {
        errors.push('US account number must be between 4 and 17 digits.');
      }
      if (accountData.swift && !validateSwift(accountData.swift)) {
        errors.push('Invalid SWIFT code.');
      }
      break;
    }
    case 'GB':
    case 'GBR':
    case 'UK': {
      if (!accountData.sortCode || !/^\d{6}$/.test(String(accountData.sortCode).replace(/[^0-9]/g, ''))) {
        errors.push('UK sort code must be 6 digits (e.g. 20-00-00).');
      }
      if (!rawAccount || !/^\d{8}$/.test(String(rawAccount).trim())) {
        errors.push('UK account number must be 8 digits.');
      }
      if (accountData.iban && !validateIban(accountData.iban)) {
        errors.push('Invalid UK IBAN checksum.');
      }
      break;
    }
    case 'CA':
    case 'CAN':
    case 'CANADA': {
      if (!accountData.institutionNumber || !/^\d{3}$/.test(String(accountData.institutionNumber).trim())) {
        errors.push('Canadian institution number must be 3 digits.');
      }
      if (!accountData.transitNumber || !/^\d{5}$/.test(String(accountData.transitNumber).trim())) {
        errors.push('Canadian transit number must be 5 digits.');
      }
      if (!rawAccount || !/^\d{7,12}$/.test(String(rawAccount).trim())) {
        errors.push('Canadian account number must be between 7 and 12 digits.');
      }
      break;
    }
    case 'AU':
    case 'AUS':
    case 'AUSTRALIA': {
      if (!accountData.bsb || !/^\d{6}$/.test(String(accountData.bsb).replace(/[^0-9]/g, ''))) {
        errors.push('Australian BSB must be 6 digits (e.g. 123-456).');
      }
      if (!rawAccount || !/^\d{5,9}$/.test(String(rawAccount).trim())) {
        errors.push('Australian account number must be between 5 and 9 digits.');
      }
      break;
    }
    default: {
      if (!rawAccount) {
        errors.push('Account number or IBAN is required.');
      }
      if (accountData.swift && !validateSwift(accountData.swift)) {
        errors.push('Invalid SWIFT code.');
      }
      if (accountData.iban && !validateIban(accountData.iban)) {
        errors.push('Invalid IBAN checksum.');
      }
      break;
    }
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
