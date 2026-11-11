const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const SALT = "queerp-smtp-encryption-salt-v1";

function getKey() {
  const secret = process.env.EMAIL_ENCRYPTION_SECRET || process.env.JWT_SECRET || "queerp-secure-secret-key-for-business-smtp";
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypts plain text (e.g. SMTP password) using AES-256-GCM.
 * Output format: "ivHex:authTagHex:encryptedHex"
 */
function encrypt(text) {
  if (!text || typeof text !== "string") return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts ciphertext created by encrypt().
 * Returns original plain text.
 */
function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== "string") return "";
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Masks a password string for safe frontend display
 */
function maskPassword(text) {
  if (!text) return "";
  return "••••••••";
}

module.exports = {
  encrypt,
  decrypt,
  maskPassword,
};

