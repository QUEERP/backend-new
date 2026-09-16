const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Add fields to TaxRule
schema = schema.replace(
  '  isRecoverable  Boolean  @default(false)\n}',
  '  isRecoverable  Boolean  @default(false)\n  countryCode    String?  @default("AE")\n  regionCode     String?\n  supplyCategory String?  @default("GOODS")\n  placeOfSupply  String?\n  priority       Int      @default(0)\n}'
);

// 2. Add fields to TaxTransaction
schema = schema.replace(
  '  taxRateId             String\n',
  '  taxRateId             String?\n'
);
schema = schema.replace(
  '  transactionId         String\n}',
  '  transactionId         String\n  overrideRate          Float?\n  overrideReason        String?   @db.Text\n  overrideTaxTypeId     String?\n  overriddenBy          String?\n  overriddenAt          DateTime?\n  overrideTaxType       TaxType?  @relation(fields: [overrideTaxTypeId], references: [id])\n  user                  User?     @relation(fields: [overriddenBy], references: [id])\n}'
);

// 3. Add relation fields to User and TaxType for overrides
schema = schema.replace(
  '  businessUsers BusinessUser[]\n}',
  '  businessUsers BusinessUser[]\n  overriddenTransactions TaxTransaction[]\n}'
);
schema = schema.replace(
  '  taxRates      TaxRate[]\n}',
  '  taxRates      TaxRate[]\n  overriddenTransactions TaxTransaction[]\n}'
);

// 4. Remove taxRules from Product
schema = schema.replace('  taxRules      TaxRule[]\n', '');

// 5. Append new models for DeliveryNote and DebitNote
schema += `
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

// 6. Add opposite relations for DeliveryNote and DebitNote
schema = schema.replace(
  '  salesOrders   SalesOrder[]\n}',
  '  salesOrders   SalesOrder[]\n  deliveryNotes DeliveryNote[]\n  debitNotes    DebitNote[]\n}'
);
schema = schema.replace(
  '  salesOrders     SalesOrder[]\n}',
  '  salesOrders     SalesOrder[]\n  deliveryNotes   DeliveryNote[]\n}'
);
schema = schema.replace(
  '  invoices    Invoice[]\n}',
  '  invoices    Invoice[]\n  deliveryNotes DeliveryNote[]\n}'
);
schema = schema.replace(
  '  purchaseReturns PurchaseReturn[]\n}',
  '  purchaseReturns PurchaseReturn[]\n  debitNotes      DebitNote[]\n}'
);
schema = schema.replace(
  '  payments    Payment[]\n}',
  '  payments    Payment[]\n  debitNotes  DebitNote[]\n}'
);
schema = schema.replace(
  '  debitNotes  DebitNote[]\n}',
  '  debitNotes  DebitNote[]\n' // If already there
); // Wait, PurchaseReturn has a creditNotes relation in older schema? No, purchaseReturns has no payments. Let's just use exact match on end of Bill.
schema = schema.replace(
  '  payments         Payment[]\n}', // Bill model
  '  payments         Payment[]\n  debitNotes       DebitNote[]\n}'
);
schema = schema.replace(
  '  payments       Payment[]\n}', // PurchaseReturn model
  '  payments       Payment[]\n  debitNotes     DebitNote[]\n}'
);
schema = schema.replace(
  '  stockAdjustments    StockAdjustmentItem[]\n}', // Product model
  '  stockAdjustments    StockAdjustmentItem[]\n  deliveryNoteItems   DeliveryNoteItem[]\n  debitNoteItems      DebitNoteItem[]\n}'
);
schema = schema.replace(
  '  stockAdjustments  StockAdjustmentItem[]\n}', // Warehouse model
  '  stockAdjustments  StockAdjustmentItem[]\n  deliveryNoteItems DeliveryNoteItem[]\n}'
);

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Clean schema update successful.');
