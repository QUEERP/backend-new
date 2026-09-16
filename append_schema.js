const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const additionalSchema = `
model DeliveryNote {
  id              String             @id @default(uuid())
  businessId      String
  customerId      String
  salesOrderId    String?
  deliveryNumber  String
  status          String             @default("DRAFT")
  date            DateTime           @default(now())
  taxPointTrigger String             @default("INVOICE")
  notes           String?            @db.Text
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  business        Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  customer        Customer           @relation(fields: [customerId], references: [id], onDelete: Cascade)
  salesOrder      SalesOrder?        @relation(fields: [salesOrderId], references: [id])
  items           DeliveryNoteItem[]
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
  description     String?
  quantity        Float
  rate            Float
  itemType        String?     @default("GOODS")
  unit            String?
  taxPercent      Float?
  
  debitNote       DebitNote   @relation(fields: [debitNoteId], references: [id], onDelete: Cascade)
  product         Product?    @relation(fields: [productId], references: [id])
}
`;

if (!schema.includes('model DeliveryNote')) {
  schema += additionalSchema;
}

// Add the opposite relations securely
function addRelation(model, relation) {
  const modelRegex = new RegExp(`(model ${model} \\{[\\s\\S]*?)(\\})`);
  schema = schema.replace(modelRegex, (match, p1, p2) => {
    if (p1.includes(relation)) return match;
    return p1 + `  ${relation}\n` + p2;
  });
}

addRelation('Business', 'DeliveryNote DeliveryNote[]');
addRelation('Business', 'DebitNote DebitNote[]');
addRelation('Customer', 'DeliveryNote DeliveryNote[]');
addRelation('SalesOrder', 'DeliveryNote DeliveryNote[]');
addRelation('Vendor', 'DebitNote DebitNote[]');
addRelation('Bill', 'DebitNote DebitNote[]');
addRelation('PurchaseReturn', 'DebitNote DebitNote[]');
addRelation('Product', 'DeliveryNoteItem DeliveryNoteItem[]');
addRelation('Product', 'DebitNoteItem DebitNoteItem[]');
addRelation('Warehouse', 'DeliveryNoteItem DeliveryNoteItem[]');

fs.writeFileSync('prisma/schema.prisma', schema);
