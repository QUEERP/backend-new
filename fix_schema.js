const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '  rates          TaxRate[]',
  '  rates          TaxRate[]\n  taxOverrides   TaxTransaction[] @relation("TaxTransactionOverrideTaxType")'
);

content = content.replace(
  '  roles            UserRoleMapping[]',
  '  roles            UserRoleMapping[]\n  taxOverrides     TaxTransaction[] @relation("TaxTransactionOverrideUser")'
);

fs.writeFileSync(path, content);
console.log('Fixed schema.prisma correctly this time.');
