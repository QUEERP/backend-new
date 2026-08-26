const fs = require('fs');

const path = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';
let content = fs.readFileSync(path, 'utf8');

// Find the enum LegacyCountry
const match = content.match(/enum LegacyCountry \{[\s\S]*?\}/);
if (match) {
  let enumContent = match[0];
  if (!enumContent.includes('@@map("Country")')) {
    enumContent = enumContent.replace(/\}$/, '  @@map("Country")\n}');
    content = content.replace(match[0], enumContent);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Updated schema.prisma with @@map('Country')");
  } else {
    console.log("Already has @@map");
  }
} else {
  console.log("Enum LegacyCountry not found");
}
