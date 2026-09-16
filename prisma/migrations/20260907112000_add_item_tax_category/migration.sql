-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "taxCategory" TEXT;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "taxCategory" TEXT;

-- AlterTable
ALTER TABLE "BillItem" ADD COLUMN     "taxCategory" TEXT;
