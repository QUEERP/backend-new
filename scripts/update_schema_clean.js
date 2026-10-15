const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const regex = /(model BillItem\s*\{[\s\S]*?warehouseId\s+String\?)/;
const replacement = `$1\r\n  taxPercent    Float?\r\n  cgst          Float?\r\n  sgst          Float?\r\n  igst          Float?\r\n  taxableAmount Float?`;

if (!content.includes('taxableAmount Float?')) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('prisma/schema.prisma', content);
  console.log('Successfully inserted tax fields into BillItem');
} else {
  console.log('Already contains taxableAmount Float?');
}
