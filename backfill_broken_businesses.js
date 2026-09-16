const prisma = require('./src/config/prisma.js');
const { provisionTaxRules, PROVISIONING_MANIFESTS } = require('./src/services/taxProvisioning.service.js');

async function backfill() {
  const allBusinesses = await prisma.business.findMany({
    include: { taxRules: true, countryRef: true }
  });

  const configuredCountries = Object.keys(PROVISIONING_MANIFESTS);
  let fixedCount = 0;
  
  console.log(`Checking ${allBusinesses.length} total businesses...`);
  
  for (const b of allBusinesses) {
    // Determine the country code
    // If it has countryRef, use its code. Else use countryCode field.
    let code = b.countryRef?.code || b.countryCode;
    
    // Fallback logic for legacy countryEnum if code is missing but enum is known
    if (!code && b.country) {
       if (b.country === 'INDIA') code = 'IN';
       else if (b.country === 'UAE') code = 'AE';
       else if (b.country === 'CANADA') code = 'CA';
    }

    if (code && configuredCountries.includes(code)) {
      if (b.taxRules.length === 0) {
        console.log(`Fixing Business: ${b.id} | Name: ${b.name} | Country: ${code}`);
        try {
          const res = await provisionTaxRules(b.id, code);
          console.log(`  -> Provisioned ${res.created} rules`);
          fixedCount++;
        } catch(e) {
          console.error(`  -> Failed to provision:`, e.message);
        }
      }
    }
  }
  
  console.log(`\nBackfill complete. Fixed ${fixedCount} broken businesses in configured countries.`);
}

backfill().finally(() => process.exit(0));
