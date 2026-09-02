const fs = require('fs');

// Patch TransactionHelper.js
const helperPath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/TransactionHelper.js';
let helperContent = fs.readFileSync(helperPath, 'utf8');

helperContent = helperContent.replace(
  /const manualOverrideReason = isManualOverride \? item\.overrideReason : null;/g,
  `const manualOverrideReason = isManualOverride ? item.overrideReason : null;
       const overrideTaxTypeId = isManualOverride ? item.overrideTaxTypeId : null;`
);

helperContent = helperContent.replace(
  /manualOverrideRate,\s*manualOverrideReason,\s*txClient/g,
  `manualOverrideRate,
           manualOverrideReason,
           overrideTaxTypeId,
           userId,
           txClient`
);
fs.writeFileSync(helperPath, helperContent);

// Patch taxEngine.js
const taxEnginePath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/taxEngine.js';
let taxEngineContent = fs.readFileSync(taxEnginePath, 'utf8');

taxEngineContent = taxEngineContent.replace(
  /manualOverrideRate = null,\s*manualOverrideReason = null,\s*txClient = prisma/g,
  `manualOverrideRate = null,
      manualOverrideReason = null,
      overrideTaxTypeId = null,
      userId = null,
      txClient = prisma`
);

const validationBlockOld = `    if (isManualOverride) {
      if (!overrideTaxTypeId) {
        throw new RateResolutionError("Manual tax overrides must specify a valid overrideTaxTypeId.");
      }
      if (manualOverrideRate === null || manualOverrideRate === undefined) {
         throw new RateResolutionError("Manual tax overrides must specify a manualOverrideRate.");
      }
      if (!overrideReason) {
         throw new RateResolutionError("Manual tax overrides must specify an overrideReason.");
      }`;

const validationBlockNew = `    if (isManualOverride) {
      if (!overrideTaxTypeId) {
        throw new RateResolutionError("Manual tax overrides must specify a valid overrideTaxTypeId.");
      }
      if (manualOverrideRate === null || manualOverrideRate === undefined) {
         throw new RateResolutionError("Manual tax overrides must specify a manualOverrideRate.");
      }
      if (!manualOverrideReason) {
         throw new RateResolutionError("Manual tax overrides must specify an overrideReason.");
      }
      
      const validTaxType = await txClient.taxType.findFirst({
        where: { 
          id: overrideTaxTypeId, 
          taxFrameworkId: business.taxFrameworkId 
        }
      });
      if (!validTaxType) {
        throw new RateResolutionError("Invalid or unauthorized tax type override.");
      }`;

taxEngineContent = taxEngineContent.replace(validationBlockOld, validationBlockNew);
taxEngineContent = taxEngineContent.replace(/overrideReason: overrideReason,/g, 'overrideReason: manualOverrideReason,');
fs.writeFileSync(taxEnginePath, taxEngineContent);

console.log('Patched TransactionHelper and TaxEngine for overrideTaxTypeId.');
