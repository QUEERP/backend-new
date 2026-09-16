const prisma = require('./src/config/prisma');

async function checkPersistence() {
  try {
    // Need a business first to satisfy the relation
    const user = await prisma.user.create({
      data: {
        email: "test_" + Date.now() + "@test.com",
        name: "Test User",
        password: "test"
      }
    });

    const business = await prisma.business.create({
      data: {
        name: "Test Persistence Business",
        owner: { connect: { id: user.id } },
        baseCurrency: { connect: { id: (await prisma.currency.findFirst({ where: { code: 'CAD' } }) || await prisma.currency.create({ data: { code: 'CAD', name: 'Canadian Dollar', symbol: '$' } })).id } }
      }
    });

    const rule = await prisma.taxRule.create({
      data: {
        businessId: business.id,
        name: "Persistence Test Rule",
        rate: 5.0,
        type: "GST",
        placeOfSupply: "INTRASTATE",
        supplyCategory: "GOODS",
        countryCode: "CA",
        regionCode: "ON",
        priority: 10
      }
    });
    console.log("Rule created successfully with ID:", rule.id);

    // Query it back
    const retrievedRule = await prisma.taxRule.findUnique({
      where: { id: rule.id }
    });

    console.log("\n--- Retrieved Rule ---");
    console.log(JSON.stringify(retrievedRule, null, 2));

    // Cleanup
    await prisma.business.delete({ where: { id: business.id } });
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

checkPersistence();
