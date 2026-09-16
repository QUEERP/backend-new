const fs = require('fs');
let code = fs.readFileSync('src/services/taxProvisioning.service.js', 'utf8');
code = code.replace(/IT: \\{/, `ID: {
      frameworkName: 'Indonesia PPN',
      rules: [
        { name: 'ID Standard PPN 11%',              rate: 11, jurisdiction: null, taxCategory: null, components: ['PPN_STANDARD'] },
        { name: 'ID Zero Rated Export 0%',          rate: 0,  jurisdiction: null, placeOfSupply: 'EXPORT', priority: -1, taxCategory: 'ZERO_RATED', components: ['PPN_ZERO'] },
      ]
    },
    IT: {`);
fs.writeFileSync('src/services/taxProvisioning.service.js', code);
