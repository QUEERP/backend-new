const fs = require('fs');

const taxEnginePath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/taxEngine.js';
let taxEngineContent = fs.readFileSync(taxEnginePath, 'utf8');

// The new override block
const oldOverrideBlock = `    if (isManualOverride) {
      if (!overrideTaxTypeId) {
        throw new RateResolutionError("Manual tax overrides must specify a valid overrideTaxTypeId.");
      }
      if (manualOverrideRate === null || manualOverrideRate === undefined) {
         throw new RateResolutionError("Manual tax overrides must specify a manualOverrideRate.");
      }
      if (!overrideReason) {
         throw new RateResolutionError("Manual tax overrides must specify an overrideReason.");
      }
      taxRuleId = null;
      taxRateId = null; 
    }`;

const newOverrideBlock = `    if (isManualOverride) {
      if (!overrideTaxTypeId) {
        throw new RateResolutionError("Manual tax overrides must specify a valid overrideTaxTypeId.");
      }
      if (manualOverrideRate === null || manualOverrideRate === undefined) {
         throw new RateResolutionError("Manual tax overrides must specify a manualOverrideRate.");
      }
      if (!overrideReason) {
         throw new RateResolutionError("Manual tax overrides must specify an overrideReason.");
      }
      
      const taxAmountTxnCcy = Number(((lineSubtotal * manualOverrideRate) / 100).toFixed(decimals));
      
      // Directly return the overridden transaction without going through rule resolution
      return [{
        taxRateId: null,
        isManualOverride: true,
        overrideRate: manualOverrideRate,
        overrideReason: overrideReason,
        overrideTaxTypeId: overrideTaxTypeId,
        overriddenBy: userId, // Assuming userId is passed in context
        overriddenAt: new Date(),
        taxAmountTxnCcy,
        taxAmountBaseCcy: Number((taxAmountTxnCcy * exchangeRate).toFixed(decimals)),
        taxableAmountBaseCcy: Number((lineSubtotal * exchangeRate).toFixed(decimals)),
        taxAmountStatutoryCcy: Number((taxAmountTxnCcy * statutoryRate).toFixed(decimals))
      }];
    }`;

taxEngineContent = taxEngineContent.replace(oldOverrideBlock, newOverrideBlock);

fs.writeFileSync(taxEnginePath, taxEngineContent);
console.log('taxEngine patched.');
