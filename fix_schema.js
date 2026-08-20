const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

const models = ['Bill', 'CreditNote', 'PurchaseOrder', 'Quotation', 'SalesOrder', 'Invoice', 'Payment', 'PurchaseRequest', 'PurchaseReturn'];

models.forEach(m => {
  // We look for the place to inject by matching transactionCurrencyId String?
  const regex = new RegExp(`(model ${m} \\{[\\s\\S]*?)(  transactionCurrencyId\\s+String\\?)`, 'm');
  s = s.replace(regex, `$1  transactionCurrency   Currency? @relation("${m}TransactionCurrency", fields: [transactionCurrencyId], references: [id], onDelete: SetNull)\n$2`);
  
  const regex2 = new RegExp(`(model ${m} \\{[\\s\\S]*?)(  baseCurrencyId\\s+String\\?)`, 'm');
  s = s.replace(regex2, `$1  baseCurrency          Currency? @relation("${m}BaseCurrency", fields: [baseCurrencyId], references: [id], onDelete: SetNull)\n$2`);
});

const currencyFields = models.map(m => {
  const camel = m.charAt(0).toLowerCase() + m.slice(1);
  let plural = camel + 's';
  return `  ${plural}Transaction ${m}[] @relation("${m}TransactionCurrency")\n` +
         `  ${plural}Base ${m}[] @relation("${m}BaseCurrency")`;
}).join('\n');

s = s.replace(/(businessesBase\\s+Business\\[\\]\\s+@relation\\("BusinessBaseCurrency"\\))/, `$1\n${currencyFields}`);

fs.writeFileSync('prisma/schema.prisma', s);
