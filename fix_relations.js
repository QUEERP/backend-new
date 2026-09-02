const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';
let content = fs.readFileSync(path, 'utf8');

// Fix Business
content = content.replace(
  '  taxRules           TaxRule[]',
  '  taxRules           TaxRule[]\n  taxTransactions    TaxTransaction[]'
);

// Fix User
content = content.replace(
  '  taxOverrides     TaxTransaction[] @relation("TaxTransactionOverrideUser")',
  '  taxOverrides     TaxTransaction[] @relation("TaxTransactionOverrideUser")\n  taxTransactions  TaxTransaction[]'
);

fs.writeFileSync(path, content);
console.log('Fixed Business and User.');
