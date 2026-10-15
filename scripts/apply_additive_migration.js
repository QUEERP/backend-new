const { Pool } = require('pg');
require('dotenv').config();

async function runAdditiveMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  console.log('Connected to PostgreSQL for additive migration.');

  try {
    await client.query('BEGIN');

    // 1. Add nullable columns to BillItem
    console.log('1. Checking and adding nullable columns to BillItem...');
    await client.query(`
      ALTER TABLE "BillItem" 
      ADD COLUMN IF NOT EXISTS "taxPercent" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "cgst" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "sgst" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "igst" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "taxableAmount" DOUBLE PRECISION;
    `);
    console.log('✓ BillItem columns verified/added.');

    // 2. Drop default "AED" from payments.currency
    console.log('2. Removing default "AED" from payments.currency...');
    await client.query(`
      ALTER TABLE "payments" ALTER COLUMN "currency" DROP DEFAULT;
    `);
    console.log('✓ Default "AED" dropped from payments.currency.');

    // 3. Create CustomerBankAccount table if not exists
    console.log('3. Creating CustomerBankAccount table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "customer_bank_accounts" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "customerId" TEXT NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
        "businessId" TEXT NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
        "accountHolderName" TEXT NOT NULL,
        "bankName" TEXT NOT NULL,
        "accountNumberEncrypted" TEXT NOT NULL,
        "accountNumberMasked" TEXT NOT NULL,
        "country" TEXT NOT NULL,
        "currency" TEXT NOT NULL,
        "ifsc" TEXT,
        "iban" TEXT,
        "swift" TEXT,
        "routingNumber" TEXT,
        "branchName" TEXT,
        "upiId" TEXT,
        "sortCode" TEXT,
        "transitNumber" TEXT,
        "institutionNumber" TEXT,
        "bsb" TEXT,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "customer_bank_accounts_customerId_idx" ON "customer_bank_accounts"("customerId");
      CREATE INDEX IF NOT EXISTS "customer_bank_accounts_businessId_idx" ON "customer_bank_accounts"("businessId");
    `);
    console.log('✓ customer_bank_accounts table verified/created.');

    // 4. Add nullable export columns to invoices table
    console.log('4. Adding nullable export columns to invoices table...');
    await client.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "exportType" TEXT,
      ADD COLUMN IF NOT EXISTS "lutNumber" TEXT,
      ADD COLUMN IF NOT EXISTS "lutDate" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "destinationCountry" TEXT,
      ADD COLUMN IF NOT EXISTS "shippingBillNumber" TEXT,
      ADD COLUMN IF NOT EXISTS "shippingBillDate" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "portCode" TEXT;
    `);
    console.log('✓ invoices export columns verified/added.');

    await client.query('COMMIT');
    console.log('Migration committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed and rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runAdditiveMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
