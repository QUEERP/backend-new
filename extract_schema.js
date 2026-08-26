const fs = require('fs');
const content = fs.readFileSync('c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma', 'utf8');

const targetModels = [
  'User', 'Business', 'Customer', 'Vendor', 'Product', 'Lead', 'Deal', 
  'Quotation', 'SalesOrder', 'Invoice', 'Payment', 'CreditNote', 
  'PurchaseRequest', 'PurchaseOrder', 'Bill', 'VendorPayment', 
  'Tax', 'TaxRate', 'Currency', 'ExchangeRate', 'JournalEntry', 'Ledger', 
  'Country', 'TaxFramework', 'TaxType', 'TaxRule', 'TaxTransaction', 'Account'
];

const models = [];
for (let i = 0; i < targetModels.length; i++) {
  const model = targetModels[i];
  const regex = new RegExp('model ' + model + ' \\{[\\s\\S]*?\\}', 'g');
  const matches = content.match(regex);
  if (matches) {
    models.push(matches[0]);
  }
}

fs.writeFileSync('c:/Users/DELL/Downloads/new-queerp/backend/schema_extract.txt', models.join('\n\n'));
