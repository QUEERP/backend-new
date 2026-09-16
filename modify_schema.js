const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/prisma/schema.prisma';

let content = fs.readFileSync(path, 'utf8');

const regex = /^\s*(taxPercent|cgstPercent|sgstPercent|igstPercent)\s+Float\??\s*(@default\(\d+\))?\s*$/gm;

const newContent = content.replace(regex, '');

fs.writeFileSync(path, newContent);
console.log('Removed India-specific tax fields and taxPercent from all models.');
