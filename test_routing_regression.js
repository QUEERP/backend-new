const prisma = require('./src/config/prisma');
const TaxResolver = require('./src/services/TaxResolver');

async function runRegression() {
  let businessId;
  try {
    const framework = await prisma.taxFramework.findFirst();
    if (!framework) throw new Error("No tax framework found.");

    const business = await prisma.business.create({
      data: {
        name: 'Routing Regression ' + Date.now(),
        taxFramework: { connect: { id: framework.id } },
        countryCode: 'CA',
        baseCurrency: { connect: { id: (await prisma.currency.findFirst()).id } },
        owner: {
            create: {
                name: "Test User",
                email: 'owner_rr_' + Date.now() + '@test.com',
                password: "hash123",
                role: "ADMIN"
            }
        }
      }
    });
    businessId = business.id;
    console.log("Created test business:", businessId);

    const taxType = await prisma.taxType.create({ data: { name: 'VAT', taxFrameworkId: framework.id } });

    // Seed 4 overlapping/competing rules

    // 1. Target rule: matches everything perfectly (priority 10)
    const targetRule = await prisma.taxRule.create({
      data: { businessId, name: "Rule 1 - Target", rate: 5, type: "STANDARD", isRecoverable: true, priority: 10, countryCode: 'CA', regionCode: 'ON', placeOfSupply: 'INTRASTATE', supplyCategory: 'GOODS' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: targetRule.id, name: "Rule 1 Rate", rate: 5, effectiveFrom: new Date('2020-01-01') } });

    // 2. Competing rule: matches perfectly but lower priority (priority 20)
    const lowerPriorityRule = await prisma.taxRule.create({
      data: { businessId, name: "Rule 2 - Lower Priority", rate: 8, type: "STANDARD", isRecoverable: true, priority: 20, countryCode: 'CA', regionCode: 'ON', placeOfSupply: 'INTRASTATE', supplyCategory: 'GOODS' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: lowerPriorityRule.id, name: "Rule 2 Rate", rate: 8, effectiveFrom: new Date('2020-01-01') } });

    // 3. Negative case: wrong country (should be filtered out before priority sorting)
    const wrongCountryRule = await prisma.taxRule.create({
      data: { businessId, name: "Rule 3 - Wrong Country", rate: 10, type: "STANDARD", isRecoverable: true, priority: 5, countryCode: 'US', regionCode: 'NY', placeOfSupply: 'INTRASTATE', supplyCategory: 'GOODS' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: wrongCountryRule.id, name: "Rule 3 Rate", rate: 10, effectiveFrom: new Date('2020-01-01') } });

    // 4. Negative case: wrong supply category (SERVICES instead of GOODS)
    const wrongCategoryRule = await prisma.taxRule.create({
      data: { businessId, name: "Rule 4 - Wrong Category", rate: 15, type: "STANDARD", isRecoverable: true, priority: 1, countryCode: 'CA', regionCode: 'ON', placeOfSupply: 'INTRASTATE', supplyCategory: 'SERVICES' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: wrongCategoryRule.id, name: "Rule 4 Rate", rate: 15, effectiveFrom: new Date('2020-01-01') } });

    // Context that matches Rule 1 and Rule 2, but NOT Rule 3 or Rule 4
    const context = {
      businessId,
      businessCountryCode: 'CA',
      businessRegionCode: 'ON',
      counterpartyCountryCode: 'CA',
      counterpartyRegionCode: 'ON',
      supplyCategory: 'GOODS',
      transactionType: 'INVOICE',
      transactionDate: new Date(),
      txClient: prisma
    };

    const resolved = await TaxResolver.resolveTaxRule(context);
    console.log("Resolver returned:", resolved);

    // Assertions
    if (resolved.taxRuleId !== targetRule.id) {
        throw new Error(`Failed: Selected wrong rule. Expected ${targetRule.id} (Rule 1), got ${resolved.taxRuleId}`);
    }
    console.log("Success: Correct rule was selected based on context and priority.");

    if (resolved.evaluatedCount !== 4) {
        throw new Error(`Failed: Evaluated count should be 4, got ${resolved.evaluatedCount}`);
    }
    
    if (resolved.candidateCount !== 2) {
        throw new Error(`Failed: Candidate count before sorting should be exactly 2 (Rule 1 and Rule 2). The other rules should have been filtered out. Got ${resolved.candidateCount}`);
    }
    console.log(`Success: Evaluated ${resolved.evaluatedCount} rules, exactly ${resolved.candidateCount} rules successfully passed the routing filters, correctly rejecting negative cases.`);

  } catch (error) {
    console.error("Regression Test Failed:", error);
  } finally { await prisma.$disconnect(); }
}

runRegression();
