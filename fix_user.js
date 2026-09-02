const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';
let content = fs.readFileSync(path, 'utf8');

// Find the User block
const startIndex = content.indexOf('model User {');
const endIndex = content.indexOf('}', startIndex);

if (startIndex > -1 && endIndex > -1) {
  const userBlock = content.substring(startIndex, endIndex);
  if (!userBlock.includes('taxOverrides')) {
    const newContent = content.substring(0, endIndex) + '  taxOverrides TaxTransaction[] @relation("TaxTransactionOverrideUser")\n' + content.substring(endIndex);
    fs.writeFileSync(path, newContent);
    console.log('Fixed User successfully.');
  } else {
    console.log('User already fixed.');
  }
}
