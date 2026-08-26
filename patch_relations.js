const fs = require('fs');

const schemaPath = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';
let content = fs.readFileSync(schemaPath, 'utf8');

const relationsToAdd = `
  paymentsTransaction     Payment[]         @relation("PaymentTransactionCurrency")
  paymentsBase            Payment[]         @relation("PaymentBaseCurrency")
  creditNotesTransaction  CreditNote[]      @relation("CreditNoteTransactionCurrency")
  creditNotesBase         CreditNote[]      @relation("CreditNoteBaseCurrency")
  quotationsTransaction   Quotation[]       @relation("QuotationTransactionCurrency")
  quotationsBase          Quotation[]       @relation("QuotationBaseCurrency")
  salesOrdersTransaction  SalesOrder[]      @relation("SalesOrderTransactionCurrency")
  salesOrdersBase         SalesOrder[]      @relation("SalesOrderBaseCurrency")
  purchaseOrdersTxn       PurchaseOrder[]   @relation("PurchaseOrderTransactionCurrency")
  purchaseOrdersBase      PurchaseOrder[]   @relation("PurchaseOrderBaseCurrency")
  billsTransaction        Bill[]            @relation("BillTransactionCurrency")
  billsBase               Bill[]            @relation("BillBaseCurrency")
  purchaseRequestsTxn     PurchaseRequest[] @relation("PurchaseRequestTransactionCurrency")
  purchaseRequestsBase    PurchaseRequest[] @relation("PurchaseRequestBaseCurrency")
  purchaseReturnsTxn      PurchaseReturn[]  @relation("PurchaseReturnTransactionCurrency")
  purchaseReturnsBase     PurchaseReturn[]  @relation("PurchaseReturnBaseCurrency")
  invoicesTransaction     Invoice[]         @relation("InvoiceTransactionCurrency")
  invoicesBase            Invoice[]         @relation("InvoiceBaseCurrency")
`;

const currencyRegex = /(model Currency \{[\s\S]*?)(^\s+@@.*|\})/m;
const currencyMatch = content.match(currencyRegex);

if (currencyMatch && !currencyMatch[0].includes('paymentsTransaction')) {
  content = content.replace(currencyRegex, `$1${relationsToAdd}\n$2`);
  fs.writeFileSync(schemaPath, content);
  console.log('Currency relations added.');
} else {
  console.log('Currency relations already exist or could not match.');
}
