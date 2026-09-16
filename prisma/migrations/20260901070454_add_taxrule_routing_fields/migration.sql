/*
  Warnings:

  - You are about to drop the column `taxRuleKey` on the `TaxRate` table. All the data in the column will be lost.
  - You are about to drop the `Country` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Currency` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExchangeRate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TaxTransaction" DROP CONSTRAINT "TaxTransaction_taxRateId_fkey";

-- DropForeignKey
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_baseCurrencyId_fkey";

-- DropForeignKey
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_countryId_fkey";

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryCredit" DOUBLE PRECISION,
ADD COLUMN     "statutoryDebit" DOUBLE PRECISION,
ADD COLUMN     "statutoryRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TaxRate" DROP COLUMN "taxRuleKey",
ADD COLUMN     "taxRuleId" TEXT;

-- AlterTable
ALTER TABLE "TaxTransaction" ADD COLUMN     "overrideRate" DOUBLE PRECISION,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "overrideTaxTypeId" TEXT,
ADD COLUMN     "taxAmountStatutoryCcy" DOUBLE PRECISION,
ADD COLUMN     "taxableAmountBaseCcy" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "transactionCurrencyId" TEXT,
ALTER COLUMN "taxRateId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "isLegacyUntracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rateIsEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutoryBaseAmount" DOUBLE PRECISION,
ADD COLUMN     "statutoryExchangeRate" DOUBLE PRECISION,
ALTER COLUMN "exchangeRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tax_rules" ADD COLUMN     "autoProvisioned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "counterpartyTaxRegistrationStatus" TEXT,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "placeOfSupply" TEXT,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "supplyCategory" TEXT,
ADD COLUMN     "taxCategory" TEXT;

-- DropTable
DROP TABLE "Country";

-- DropTable
DROP TABLE "Currency";

-- DropTable
DROP TABLE "ExchangeRate";

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "decimalPrecision" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "fromCurrencyId" TEXT NOT NULL,
    "toCurrencyId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "rateType" TEXT NOT NULL DEFAULT 'COMMERCIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate_rules" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "baseCurrencyId" TEXT NOT NULL,
    "requiresStatutoryRate" BOOLEAN NOT NULL DEFAULT false,
    "statutoryRateSource" TEXT,

    CONSTRAINT "exchange_rate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "deliveryNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxPointTrigger" TEXT NOT NULL DEFAULT 'INVOICE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryNoteItem" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "warehouseId" TEXT,
    "itemName" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,

    CONSTRAINT "DeliveryNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billId" TEXT,
    "purchaseReturnId" TEXT,
    "debitNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "transactionCurrencyId" TEXT,
    "baseCurrencyId" TEXT,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "baseCurrencyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "statutoryExchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "statutoryBaseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNoteItem" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "itemName" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "itemType" TEXT DEFAULT 'GOODS',
    "unit" TEXT,
    "taxPercent" DOUBLE PRECISION,

    CONSTRAINT "DebitNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE INDEX "exchange_rates_fromCurrencyId_toCurrencyId_rateType_effecti_idx" ON "exchange_rates"("fromCurrencyId", "toCurrencyId", "rateType", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_fromCurrencyId_toCurrencyId_effectiveDate_ra_key" ON "exchange_rates"("fromCurrencyId", "toCurrencyId", "effectiveDate", "rateType");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_rules_countryId_baseCurrencyId_key" ON "exchange_rate_rules"("countryId", "baseCurrencyId");

-- CreateIndex
CREATE INDEX "Bill_businessId_transactionCurrencyId_idx" ON "Bill"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "Bill_businessId_billDate_idx" ON "Bill"("businessId", "billDate");

-- CreateIndex
CREATE INDEX "CreditNote_businessId_transactionCurrencyId_idx" ON "CreditNote"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "CreditNote_businessId_createdAt_idx" ON "CreditNote"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_transactionCurrencyId_idx" ON "PurchaseOrder"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_orderDate_idx" ON "PurchaseOrder"("businessId", "orderDate");

-- CreateIndex
CREATE INDEX "Quotation_businessId_transactionCurrencyId_idx" ON "Quotation"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "Quotation_businessId_issueDate_idx" ON "Quotation"("businessId", "issueDate");

-- CreateIndex
CREATE INDEX "SalesOrder_businessId_transactionCurrencyId_idx" ON "SalesOrder"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "SalesOrder_businessId_orderDate_idx" ON "SalesOrder"("businessId", "orderDate");

-- CreateIndex
CREATE INDEX "TaxTransaction_taxRateId_idx" ON "TaxTransaction"("taxRateId");

-- CreateIndex
CREATE INDEX "TaxTransaction_businessId_createdAt_idx" ON "TaxTransaction"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_businessId_transactionCurrencyId_idx" ON "invoices"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "payments_businessId_transactionCurrencyId_idx" ON "payments"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "purchase_requests_businessId_transactionCurrencyId_idx" ON "purchase_requests"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "purchase_requests_businessId_createdAt_idx" ON "purchase_requests"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_returns_businessId_transactionCurrencyId_idx" ON "purchase_returns"("businessId", "transactionCurrencyId");

-- CreateIndex
CREATE INDEX "purchase_returns_businessId_createdAt_idx" ON "purchase_returns"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_fromCurrencyId_fkey" FOREIGN KEY ("fromCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_toCurrencyId_fkey" FOREIGN KEY ("toCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_taxRuleId_fkey" FOREIGN KEY ("taxRuleId") REFERENCES "tax_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_transactionCurrencyId_fkey" FOREIGN KEY ("transactionCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate_rules" ADD CONSTRAINT "exchange_rate_rules_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate_rules" ADD CONSTRAINT "exchange_rate_rules_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
