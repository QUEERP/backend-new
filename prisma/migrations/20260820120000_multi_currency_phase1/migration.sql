-- CreateEnum
CREATE TYPE "LegacyCountry" AS ENUM ('AFGHANISTAN', 'ALBANIA', 'ALGERIA', 'ARGENTINA', 'AUSTRALIA', 'AUSTRIA', 'BAHRAIN', 'BANGLADESH', 'BELGIUM', 'BRAZIL', 'CANADA', 'CHILE', 'CHINA', 'COLOMBIA', 'CROATIA', 'CZECH_REPUBLIC', 'DENMARK', 'EGYPT', 'ETHIOPIA', 'FINLAND', 'FRANCE', 'GERMANY', 'GHANA', 'GREECE', 'HONG_KONG', 'HUNGARY', 'INDIA', 'INDONESIA', 'IRAN', 'IRAQ', 'IRELAND', 'ISRAEL', 'ITALY', 'JAPAN', 'JORDAN', 'KAZAKHSTAN', 'KENYA', 'KUWAIT', 'LEBANON', 'MALAYSIA', 'MEXICO', 'MOROCCO', 'MYANMAR', 'NEPAL', 'NETHERLANDS', 'NEW_ZEALAND', 'NIGERIA', 'NORWAY', 'OMAN', 'PAKISTAN', 'PHILIPPINES', 'POLAND', 'PORTUGAL', 'QATAR', 'ROMANIA', 'RUSSIA', 'SAUDI_ARABIA', 'SINGAPORE', 'SOUTH_AFRICA', 'SOUTH_KOREA', 'SPAIN', 'SRI_LANKA', 'SWEDEN', 'SWITZERLAND', 'TAIWAN', 'TANZANIA', 'THAILAND', 'TUNISIA', 'TURKEY', 'UKRAINE', 'UNITED_ARAB_EMIRATES', 'UNITED_KINGDOM', 'UNITED_STATES', 'VENEZUELA', 'VIETNAM', 'ZIMBABWE', 'UAE', 'OTHER');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "baseCredit" DOUBLE PRECISION,
ADD COLUMN     "baseDebit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "taxFrameworkId" TEXT,
DROP COLUMN "country",
ADD COLUMN     "country" "LegacyCountry" NOT NULL DEFAULT 'INDIA';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "exchangeRate" DOUBLE PRECISION DEFAULT 1.0,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- AlterTable
ALTER TABLE "purchase_returns" ADD COLUMN     "baseCurrencyAmount" DOUBLE PRECISION,
ADD COLUMN     "baseCurrencyId" TEXT,
ADD COLUMN     "transactionCurrencyId" TEXT;

-- DropEnum
DROP TYPE "Country";

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrencyId" TEXT NOT NULL,
    "toCurrencyId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFramework" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TaxFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxType" (
    "id" TEXT NOT NULL,
    "taxFrameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TaxType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "taxTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "taxRuleKey" TEXT NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxTransaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "taxAmountTxnCcy" DOUBLE PRECISION NOT NULL,
    "taxAmountBaseCcy" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxFramework_countryId_key" ON "TaxFramework"("countryId");

-- CreateIndex
CREATE INDEX "TaxTransaction_businessId_idx" ON "TaxTransaction"("businessId");

-- CreateIndex
CREATE INDEX "TaxTransaction_transactionType_transactionId_idx" ON "TaxTransaction"("transactionType", "transactionId");

-- CreateIndex
CREATE INDEX "Bill_businessId_billDate_transactionCurrencyId_idx" ON "Bill"("businessId", "billDate", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_orderDate_transactionCurrencyId_idx" ON "PurchaseOrder"("businessId", "orderDate", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "payments_businessId_paymentDate_transactionCurrencyId_idx" ON "payments"("businessId", "paymentDate", "transactionCurrencyId");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_taxFrameworkId_fkey" FOREIGN KEY ("taxFrameworkId") REFERENCES "TaxFramework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxType" ADD CONSTRAINT "TaxType_taxFrameworkId_fkey" FOREIGN KEY ("taxFrameworkId") REFERENCES "TaxFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

