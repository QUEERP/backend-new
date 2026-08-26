const fs = require('fs');

const schemaPath = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';
let content = fs.readFileSync(schemaPath, 'utf8');

const modelsToUpdate = [
  'Invoice', 'Quotation', 'SalesOrder', 'PurchaseRequest',
  'PurchaseOrder', 'Bill', 'CreditNote', 'Payment', 'JournalEntry'
];

modelsToUpdate.forEach(model => {
  const regex = new RegExp(`(model ${model} \\{[\\s\\S]*?)(^\\s+@@.*|\\})`, 'm');
  const match = content.match(regex);
  if (match) {
    let modelContent = match[0];
    
    // Remove @default(1.0) from exchangeRate
    modelContent = modelContent.replace(/exchangeRate\s+Float\?\s+@default\(1\.0\)/g, 'exchangeRate       Float?');
    
    // Add isLegacyUntracked if not exists
    if (!modelContent.includes('isLegacyUntracked')) {
      const fieldToAdd = `\n  isLegacyUntracked Boolean @default(false)\n`;
      modelContent = modelContent.replace(/(^\s+@@.*|\})/m, `${fieldToAdd}$1`);
    }

    content = content.replace(regex, modelContent);
  } else {
      console.log(`Could not match model ${model}`);
  }
});

fs.writeFileSync(schemaPath, content);
console.log('Schema revised successfully.');
