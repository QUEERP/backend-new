const fs = require('fs');
let code = fs.readFileSync('src/services/taxProvisioning.service.js', 'utf8');
code = code.replace(/(\{\s*name:\s*'[A-Z]{2}\s+[^']+',\s*rate:\s*0,\s*jurisdiction:\s*null,\s*)taxCategory:\s*'ZERO_RATED'/g, "$1placeOfSupply: null, taxCategory: 'ZERO_RATED'");
fs.writeFileSync('src/services/taxProvisioning.service.js', code);
console.log('Fixed zero rated rules');
