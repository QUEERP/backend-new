const { PROVISIONING_MANIFESTS } = require('./src/services/taxProvisioning.service.js');

async function auditExportRules() {
    const countries = Object.keys(PROVISIONING_MANIFESTS);
    console.log(`Auditing ${countries.length} countries for Export (ZERO_RATED) rules...`);
    
    const results = [];
    let passCount = 0;
    let failCount = 0;
    
    for (const countryCode of countries) {
        const manifest = PROVISIONING_MANIFESTS[countryCode];
        
        // Find if there is a ZERO_RATED or EXEMPT rule that acts as an export rule
        const hasExportRule = manifest.rules.some(r => r.taxCategory === 'ZERO_RATED' || r.taxCategory === 'EXEMPT');
        
        if (hasExportRule) {
            results.push(`${countryCode}: PASS - Has Export Rule`);
            passCount++;
        } else {
            results.push(`${countryCode}: FAIL - Missing Export Rule`);
            failCount++;
        }
    }
    
    console.log("\n--- Audit Results ---");
    console.log(results.join('\n'));
    console.log("\n--- Summary ---");
    console.log(`Total: ${countries.length} | PASS: ${passCount} | FAIL: ${failCount}`);
}

auditExportRules().catch(console.error);
