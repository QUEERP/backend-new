const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

const models = ['Bill', 'CreditNote', 'PurchaseOrder', 'Quotation', 'SalesOrder', 'Invoice', 'Payment', 'PurchaseRequest', 'PurchaseReturn'];

models.forEach(m => {
  const regex = new RegExp('(model ' + m + ' \\{[\\s\\S]*?)(  baseCurrencyAmount\\s+Float\\?)', 'm');
  s = s.replace(regex, '\  transactionCurrency   Currency? @relation("' + m + 'TransactionCurrency", fields: [transactionCurrencyId], references: [id], onDelete: SetNull)\n  baseCurrency          Currency? @relation("' + m + 'BaseCurrency", fields: [baseCurrencyId], references: [id], onDelete: SetNull)\n');
});

const currencyFields = models.map(m => {
  const camel = m.charAt(0).toLowerCase() + m.slice(1);
  return '  ' + camel + 'sTransaction ' + m + '[] @relation("' + m + 'TransactionCurrency")\n' +
         '  ' + camel + 'sBase ' + m + '[] @relation("' + m + 'BaseCurrency")';
}).join('\n');

s = s.replace(/(businessesBase Business\\[\\] @relation\\("BusinessBaseCurrency"\\))/, '\\n' + currencyFields);

fs.writeFileSync('prisma/schema.prisma', s);
