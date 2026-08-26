const fs = require('fs');

const schemaPath = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';
let content = fs.readFileSync(schemaPath, 'utf8');

const modelsToUpdate = [
  'Invoice', 'Quotation', 'SalesOrder', 'PurchaseRequest',
  'PurchaseOrder', 'Bill', 'CreditNote', 'Payment'
];

modelsToUpdate.forEach(model => {
  const regex = new RegExp(`(model ${model} \\{[\\s\\S]*?)(^\\s+@@.*|\\})`, 'm');
  const match = content.match(regex);
  if (match) {
    const fieldsToAdd = `
  // [NEW] Dual-Rate Statutory Requirements
  statutoryExchangeRate Float?
  statutoryBaseAmount   Float?
`;
    // Only add if not already there
    if (!match[0].includes('statutoryExchangeRate')) {
      content = content.replace(regex, `$1${fieldsToAdd}\n$2`);
    }
  } else {
      console.log(`Could not match model ${model}`);
  }
});

// Update JournalEntry
const jeRegex = /(model JournalEntry \{[\s\S]*?)(^\s+@@.*|\})/m;
const jeMatch = content.match(jeRegex);
if (jeMatch && !jeMatch[0].includes('statutoryRate')) {
  const fieldsToAdd = `
  // Phase 1 Additions (Dual-Rate)
  statutoryRate    Float?
  statutoryDebit   Float?
  statutoryCredit  Float?
`;
  content = content.replace(jeRegex, `$1${fieldsToAdd}\n$2`);
}

// Update TaxTransaction
const taxRegex = /(model TaxTransaction \{[\s\S]*?)(^\s+@@.*|\})/m;
const taxMatch = content.match(taxRegex);
if (taxMatch && !taxMatch[0].includes('taxAmountStatutoryCcy')) {
  const fieldsToAdd = `
  taxAmountStatutoryCcy Float?
`;
  content = content.replace(taxRegex, `$1${fieldsToAdd}\n$2`);
}

// Update ExchangeRate
const erRegex = /(model ExchangeRate \{[\s\S]*?)(^\s+@@.*|\})/m;
const erMatch = content.match(erRegex);
if (erMatch && !erMatch[0].includes('rateType')) {
  const fieldsToAdd = `
  rateType       String   @default("COMMERCIAL") // 'COMMERCIAL' | 'STATUTORY'
  fromCurrency   Currency @relation("FromExchangeRates", fields: [fromCurrencyId], references: [id])
  toCurrency     Currency @relation("ToExchangeRates", fields: [toCurrencyId], references: [id])
`;
  content = content.replace(erRegex, `$1${fieldsToAdd}\n$2`);
}

// Update Country
const countryRegex = /(model Country \{[\s\S]*?)(^\s+@@.*|\})/m;
const countryMatch = content.match(countryRegex);
if (countryMatch && !countryMatch[0].includes('exchangeRateRules')) {
  const fieldsToAdd = `
  exchangeRateRules ExchangeRateRule[]
`;
  content = content.replace(countryRegex, `$1${fieldsToAdd}\n$2`);
}

// Update Currency
const currencyRegex = /(model Currency \{[\s\S]*?)(^\s+@@.*|\})/m;
const currencyMatch = content.match(currencyRegex);
if (currencyMatch && !currencyMatch[0].includes('exchangeRateRules')) {
  const fieldsToAdd = `
  exchangeRateRules ExchangeRateRule[]
  ratesFrom         ExchangeRate[] @relation("FromExchangeRates")
  ratesTo           ExchangeRate[] @relation("ToExchangeRates")
`;
  content = content.replace(currencyRegex, `$1${fieldsToAdd}\n$2`);
}

// Add ExchangeRateRule model
const exchangeRateRuleModel = `
model ExchangeRateRule {
  id                    String   @id @default(uuid())
  countryId             String
  baseCurrencyId        String
  
  requiresStatutoryRate Boolean  @default(false)
  statutoryRateSource   String?

  country               Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)
  baseCurrency          Currency @relation(fields: [baseCurrencyId], references: [id], onDelete: Cascade)

  @@unique([countryId, baseCurrencyId])
  @@map("exchange_rate_rules")
}
`;

if (!content.includes('model ExchangeRateRule')) {
  content += exchangeRateRuleModel;
}

fs.writeFileSync(schemaPath, content);
console.log('Schema updated successfully.');
