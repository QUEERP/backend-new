const fs = require('fs');

const pWorkflow = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/productWorkflow.js';
let cWorkflow = fs.readFileSync(pWorkflow, 'utf8');

cWorkflow = cWorkflow.replace(
  /taxCode: hsnCode \|\| null,\s*unit: unit \|\| 'pcs',/g,
  "taxCode: hsnCode || null,\n          taxPercent: Number(taxPercent || 0),\n          unit: unit || 'pcs',"
);

fs.writeFileSync(pWorkflow, cWorkflow);

const pController = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/productController.js';
let cController = fs.readFileSync(pController, 'utf8');

cController = cController.replace(
  /hsnCode: taxCode,\s*unit,/g,
  "hsnCode: taxCode,\n      taxPercent: Number(taxPercent || 0),\n      unit,"
);

fs.writeFileSync(pController, cController);

console.log('Fixed backend product creation taxPercent loss');
