const fs = require('fs');

// Patch statutoryRegistry.js
const regPath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/config/reports/statutoryRegistry.js';
let regContent = fs.readFileSync(regPath, 'utf8');

regContent = regContent.replace(
  /include: \{\s*taxRate: \{ include: \{ taxType: true \} \}\s*\}/g,
  `include: { taxRate: { include: { taxType: true } }, overrideTaxType: true }`
);
regContent = regContent.replace(
  /include: \{\s*taxRate: \{\s*include: \{\s*taxType: true,\s*taxRule: true\s*\}\s*\}\s*\}/g,
  `include: { taxRate: { include: { taxType: true, taxRule: true } }, overrideTaxType: true }`
);

// Grouping fixes
regContent = regContent.replace(/const rate = t\.taxRate\.rate;/g, 'const rate = t.taxRate?.rate ?? t.overrideRate ?? 0;');
regContent = regContent.replace(/const taxTypeName = t\.taxRate\.taxType\.name;/g, "const taxTypeName = t.taxRate?.taxType?.name ?? t.overrideTaxType?.name ?? 'UNKNOWN';");
regContent = regContent.replace(/const taxName = t\.taxRate\.taxType\.name\.toUpperCase\(\);/g, "const taxName = (t.taxRate?.taxType?.name ?? t.overrideTaxType?.name ?? 'UNKNOWN').toUpperCase();");
regContent = regContent.replace(/const typeName = t\.taxRate\.taxType\.name;/g, "const typeName = t.taxRate?.taxType?.name ?? t.overrideTaxType?.name ?? 'UNKNOWN';");
regContent = regContent.replace(/"Tax Type": t\.taxRate\.taxType\.name,/g, '"Tax Type": t.taxRate?.taxType?.name ?? t.overrideTaxType?.name ?? \'UNKNOWN\',');
regContent = regContent.replace(/"Tax Rate \(\%\)": t\.taxRate\.rate,/g, '"Tax Rate (%)": t.taxRate?.rate ?? t.overrideRate ?? 0,');
fs.writeFileSync(regPath, regContent);

// Patch reportController.js
const repCtrlPath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/reportController.js';
let repCtrlContent = fs.readFileSync(repCtrlPath, 'utf8');
repCtrlContent = repCtrlContent.replace(
  /if \(taxTypeId\) where\.taxRate\.taxType\.id = taxTypeId;\n\s*if \(taxFrameworkId\) where\.taxRate\.taxType\.taxFrameworkId = taxFrameworkId;/g,
  `if (taxTypeId || taxFrameworkId) {
      where.OR = where.OR || [];
      if (taxTypeId) {
        where.OR.push({ taxRate: { taxType: { id: taxTypeId } } }, { overrideTaxTypeId: taxTypeId });
      }
      if (taxFrameworkId) {
        where.OR.push({ taxRate: { taxType: { taxFrameworkId } } }, { overrideTaxType: { taxFrameworkId } });
      }
    }`
);
fs.writeFileSync(repCtrlPath, repCtrlContent);

// Patch taxStatutoryExportController.js
const exportCtrlPath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/taxStatutoryExportController.js';
let exportCtrlContent = fs.readFileSync(exportCtrlPath, 'utf8');
exportCtrlContent = exportCtrlContent.replace(
  /if \(taxTypeId\) where\.taxRate\.taxType\.id = taxTypeId;\n\s*if \(taxFrameworkId\) where\.taxRate\.taxType\.taxFrameworkId = taxFrameworkId;/g,
  `if (taxTypeId || taxFrameworkId) {
      where.OR = where.OR || [];
      if (taxTypeId) {
        where.OR.push({ taxRate: { taxType: { id: taxTypeId } } }, { overrideTaxTypeId: taxTypeId });
      }
      if (taxFrameworkId) {
        where.OR.push({ taxRate: { taxType: { taxFrameworkId } } }, { overrideTaxType: { taxFrameworkId } });
      }
    }`
);
fs.writeFileSync(exportCtrlPath, exportCtrlContent);

// Patch taxEngine.js
const taxEnginePath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/taxEngine.js';
let taxEngineContent = fs.readFileSync(taxEnginePath, 'utf8');
const manualOverrideBlock = `    if (isManualOverride && manualOverrideRate !== null) {
      // Find a generic override rule matching the rate, or throw error requiring one
      const rule = await txClient.taxRule.findFirst({
        where: { businessId, rate: manualOverrideRate },
        include: { rates: true }
      });
      if (!rule) {
         throw new RateResolutionError(\`Manual override failed: No rule matches rate \${manualOverrideRate}\`);
      }
      taxRuleId = rule.id;
      // Get active rate
      const activeRate = rule.rates.find(r => 
        new Date(r.effectiveFrom) <= new Date(transactionDate) && 
        (!r.effectiveTo || new Date(r.effectiveTo) >= new Date(transactionDate))
      );
      taxRateId = activeRate ? activeRate.id : null;
    }`;

const newManualOverrideBlock = `    if (isManualOverride) {
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

taxEngineContent = taxEngineContent.replace(manualOverrideBlock, newManualOverrideBlock);
fs.writeFileSync(taxEnginePath, taxEngineContent);

console.log('Backend files patched successfully.');
