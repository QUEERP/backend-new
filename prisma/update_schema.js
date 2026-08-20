const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.scripted.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Rename the legacy Country enum
schema = schema.replace('enum Country {', 'enum LegacyCountry {');
// Rename usage in Business model
schema = schema.replace('country            Country   @default(INDIA)', 'country            LegacyCountry   @default(INDIA)');

const txFields = `
  // Phase 1 Multi-Currency Additions
  transactionCurrencyId String?
  baseCurrencyId        String?
  baseCurrencyAmount    Float?
`;

const prFields = `
  // Phase 1 Multi-Currency Additions
  transactionCurrencyId String?
  baseCurrencyId        String?
  exchangeRate          Float?    @default(1.0)
  baseCurrencyAmount    Float?
`;

const insertIntoModel = (modelName, fieldsToInsert, indexToInsert = null) => {
  const modelRegex = new RegExp(`(model\\s+${modelName}\\s+\\{[\\s\\S]*?)(@@|\\})`);
  schema = schema.replace(modelRegex, (match, p1, p2) => {
    let insertion = fieldsToInsert;
    if (indexToInsert && p2.startsWith('@@')) {
      insertion += `\n  ${indexToInsert}\n  `;
    }
    return p1 + insertion + p2;
  });
};

// 1. Business
const businessFields = `
  // Phase 1 Multi-Country / Multi-Currency Additions
  countryId          String?
  baseCurrencyId     String?
  taxFrameworkId     String?

  countryRef         Country?       @relation(fields: [countryId], references: [id])
  baseCurrency       Currency?      @relation("BusinessBaseCurrency", fields: [baseCurrencyId], references: [id])
  taxFramework       TaxFramework?  @relation(fields: [taxFrameworkId], references: [id])
  taxTransactions    TaxTransaction[]
`;
insertIntoModel('Business', businessFields);

// 2. Transaction Models
['Quotation', 'SalesOrder', 'Invoice', 'PurchaseReturn', 'CreditNote'].forEach(model => {
  insertIntoModel(model, txFields);
});

// PurchaseRequest gets exchangeRate too
insertIntoModel('PurchaseRequest', prFields);

// Models with custom indexes
insertIntoModel('Bill', txFields, '@@index([businessId, billDate, transactionCurrencyId])');
insertIntoModel('PurchaseOrder', txFields, '@@index([businessId, orderDate, transactionCurrencyId])');
insertIntoModel('Payment', txFields, '@@index([businessId, paymentDate, transactionCurrencyId])');

// 3. JournalEntry
const journalEntryFields = `
  // Phase 1 Additions
  baseDebit           Float?
  baseCredit          Float?
`;
insertIntoModel('JournalEntry', journalEntryFields);

// 4. New Models
const newModels = `

// --- Phase 1 Multi-Country / Multi-Currency Models ---

model Country {
  id        String   @id @default(uuid())
  code      String   @unique
  name      String
  businesses Business[]
}

model Currency {
  id             String   @id @default(uuid())
  code           String   @unique
  name           String
  symbol         String
  decimals       Int      @default(2)
  businessesBase Business[] @relation("BusinessBaseCurrency")
}

model ExchangeRate {
  id             String   @id @default(uuid())
  fromCurrencyId String
  toCurrencyId   String
  rate           Float
  effectiveDate  DateTime
  source         String?
  createdAt      DateTime @default(now())
}

model TaxFramework {
  id         String   @id @default(uuid())
  countryId  String   @unique
  name       String
  taxTypes   TaxType[]
  businesses Business[]
}

model TaxType {
  id             String       @id @default(uuid())
  taxFrameworkId String
  name           String
  rates          TaxRate[]
  taxFramework   TaxFramework @relation(fields: [taxFrameworkId], references: [id], onDelete: Cascade)
}

model TaxRate {
  id             String    @id @default(uuid())
  taxTypeId      String
  name           String
  rate           Float
  effectiveFrom  DateTime
  effectiveTo    DateTime?
  taxRuleKey     String
  taxType        TaxType   @relation(fields: [taxTypeId], references: [id], onDelete: Cascade)
  taxTransactions TaxTransaction[]
}

model TaxTransaction {
  id                  String   @id @default(uuid())
  businessId          String
  transactionType     String
  transactionId       String
  taxRateId           String
  taxAmountTxnCcy     Float
  taxAmountBaseCcy    Float
  createdAt           DateTime @default(now())
  
  business            Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  taxRate             TaxRate  @relation(fields: [taxRateId], references: [id], onDelete: Restrict)
  @@index([businessId])
  @@index([transactionType, transactionId])
}
`;

schema += newModels;

fs.writeFileSync(schemaPath, schema);
console.log('Schema updated successfully.');
