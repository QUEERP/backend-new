const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// I will re-append the DeliveryNote and DebitNote blocks first because git restore wiped them out.
const deliveryNoteSchema = `
model DeliveryNote {
  id            String             @id @default(uuid())
  businessId    String
  customerId    String
  salesOrderId  String?
  deliveryNumber String
  status        String             @default("DRAFT") // DRAFT, DISPATCHED, DELIVERED, CANCELLED
  date          DateTime           @default(now())
  taxPointTrigger String           @default("INVOICE") // Known limitation: strictly informational currently
  notes         String?            @db.Text
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  business      Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  customer      Customer           @relation(fields: [customerId], references: [id], onDelete: Cascade)
  salesOrder    SalesOrder?        @relation(fields: [salesOrderId], references: [id])
  items         DeliveryNoteItem[]
}

model DeliveryNoteItem {
  id               String       @id @default(uuid())
  deliveryNoteId   String
  productId        String?
  warehouseId      String?
  itemName         String?
  quantity         Float
  unit             String?
  
  deliveryNote     DeliveryNote @relation(fields: [deliveryNoteId], references: [id], onDelete: Cascade)
  product          Product?     @relation(fields: [productId], references: [id])
  warehouse        Warehouse?   @relation(fields: [warehouseId], references: [id])
}
`;

const debitNoteSchema = `
model DebitNote {
  id                    String            @id @default(uuid())
  businessId            String
  vendorId              String
  billId                String?
  purchaseReturnId      String?
  debitNumber           String
  amount                Float
  remainingAmount       Float
  reason                String?           @db.Text
  status                String            @default("OPEN")
  date                  DateTime          @default(now())
  
  currency              String            @default("AED")
  transactionCurrencyId String?
  baseCurrencyId        String?
  exchangeRate          Float             @default(1.0)
  baseCurrencyAmount    Float             @default(0.0)
  statutoryExchangeRate Float             @default(1.0)
  statutoryBaseAmount   Float             @default(0.0)

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  business              Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  vendor                Vendor            @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  bill                  Bill?             @relation(fields: [billId], references: [id])
  purchaseReturn        PurchaseReturn?   @relation(fields: [purchaseReturnId], references: [id])
  items                 DebitNoteItem[]
}

model DebitNoteItem {
  id              String      @id @default(uuid())
  debitNoteId     String
  productId       String?
  itemName        String?
  description     String
  quantity        Float
  rate            Float
  itemType        String?     @default("GOODS")
  unit            String?
  taxPercent      Float?
  
  debitNote       DebitNote   @relation(fields: [debitNoteId], references: [id], onDelete: Cascade)
  product         Product?    @relation(fields: [productId], references: [id])
}
`;

if (!schema.includes('model DeliveryNote')) schema += deliveryNoteSchema;
if (!schema.includes('model DebitNote')) schema += debitNoteSchema;

// Helper to inject fields inside a model
function injectFields(modelName, newFields) {
  const regex = new RegExp(\`(model \${modelName} \\{[\\\\s\\\\S]*?)(\\\\n\\})\`);
  if (schema.match(regex)) {
      schema = schema.replace(regex, (match, p1, p2) => {
          if (p1.includes(newFields.trim())) return match;
          return p1 + '\\n  ' + newFields + p2;
      });
  }
}

injectFields('Business', 'deliveryNotes DeliveryNote[]\\n  debitNotes DebitNote[]');
injectFields('Customer', 'deliveryNotes DeliveryNote[]');
injectFields('SalesOrder', 'deliveryNotes DeliveryNote[]');
injectFields('Vendor', 'debitNotes DebitNote[]');
injectFields('Bill', 'debitNotes DebitNote[]');
injectFields('PurchaseReturn', 'debitNotes DebitNote[]');
injectFields('Product', 'deliveryNoteItems DeliveryNoteItem[]\\n  debitNoteItems DebitNoteItem[]');
injectFields('Warehouse', 'deliveryNoteItems DeliveryNoteItem[]');

fs.writeFileSync('prisma/schema.prisma', schema);
