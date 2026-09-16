const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

if (!schema.includes('overrideRate')) {
  // Make taxRateId nullable
  schema = schema.replace(
    '  taxRateId             String\n',
    '  taxRateId             String?\n'
  );
  
  // Add override fields to TaxTransaction
  schema = schema.replace(
    '  transactionId         String\n}',
    '  transactionId         String\n  overrideRate          Float?\n  overrideReason        String?   @db.Text\n  overrideTaxTypeId     String?\n  overriddenBy          String?\n  overriddenAt          DateTime?\n  overrideTaxType       TaxType?  @relation(fields: [overrideTaxTypeId], references: [id])\n  user                  User?     @relation(fields: [overriddenBy], references: [id])\n}'
  );

  // Add relation fields to User and TaxType for overrides
  schema = schema.replace(
    '  businessUsers BusinessUser[]\n}',
    '  businessUsers BusinessUser[]\n  overriddenTransactions TaxTransaction[]\n}'
  );
  
  schema = schema.replace(
    '  taxRates      TaxRate[]\n}',
    '  taxRates      TaxRate[]\n  overriddenTransactions TaxTransaction[]\n}'
  );

  fs.writeFileSync('prisma/schema.prisma', schema);
  console.log('Appended override fields.');
} else {
  console.log('Already appended.');
}
