const prisma = require('./src/config/prisma');
const TaxResolver = require('./src/services/TaxResolver');

async function run() {
  try {
    // 1. Create a dummy business with intact rules
    const user = await prisma.user.findFirst();
    const business = await prisma.business.create({
      data: {
        name: 'Test Intact Rules Business',
        ownerId: user.id,
        isActive: true,
        countryCode: 'CA',
        state: 'BC'
      }
    });

    // 2. Add some "normal" rules
    await prisma.taxRule.create({
      data: {
        businessId: business.id,
        name: "CA PST 7%",
        rate: 7.0,
        type: "PST",
        countryCode: "CA",
        regionCode: "BC",
        placeOfSupply: "INTRASTATE",
        supplyCategory: "GOODS",
        priority: 10
      }
    });

    await prisma.taxRule.create({
      data: {
        businessId: business.id,
        name: "CA GST 5%",
        rate: 5.0,
        type: "GST",
        countryCode: "CA",
        placeOfSupply: "DOMESTIC",
        supplyCategory: "GOODS",
        priority: 20
      }
    });

    console.log("Created intact rules for CA.");

    // 3. Try to resolve for a context that legitimately has no match (e.g., Export to ZZ, or supplyCategory=SERVICES where only GOODS exist)
    console.log("\nAttempting to resolve for Export to ZZ...");
    try {
      await TaxResolver.resolveTaxRule({
        businessId: business.id,
        businessCountryCode: 'CA',
        businessRegionCode: 'BC',
        counterpartyCountryCode: 'ZZ', // EXPORT
        counterpartyRegionCode: 'XX',
        supplyCategory: 'GOODS',
        counterpartyTaxRegistrationStatus: 'UNREGISTERED',
        txClient: prisma
      });
      console.log("FAIL: Resolution succeeded but should have failed.");
    } catch (e) {
      console.log("PASS: Caught expected error for missing tax rule:");
      console.log("Error Message:", e.message);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
