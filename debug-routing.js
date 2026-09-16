const prisma = require('./src/config/prisma');
const TaxResolver = require('./src/services/TaxResolver');

async function debug() {
  try {
    const business = await prisma.business.findFirst({ where: { countryCode: 'IN' } });
    if (!business) {
       console.log("Run test-batch-1-rigor.js first to seed an IN business.");
       return;
    }

    // Case B context (Export Goods)
    const ctxA = {
        businessId: business.id,
        businessCountryCode: 'IN',
        businessRegionCode: null,
        counterpartyCountryCode: 'IN',
        counterpartyRegionCode: null,
        supplyCategory: 'GOODS',
        counterpartyTaxRegistrationStatus: 'REGISTERED',
        transactionType: 'INVOICE',
        transactionDate: new Date(),
        txClient: prisma
    };
    const { txClient: ___, ...logCtxA } = ctxA;
    console.log("=== CASE A: DOMESTIC GOODS ===");
    console.log("CONTEXT A:", JSON.stringify(logCtxA, null, 2));
    const placeOfSupplyA = TaxResolver.determinePlaceOfSupply(ctxA);
    console.log("DETERMINED PLACE OF SUPPLY A:", placeOfSupplyA);
    try {
        const rA = await TaxResolver.resolveTaxRule(ctxA);
        console.log("RESOLVED RULE A:", rA.name);
    } catch (e) {
        console.log("RESOLVE A FAILED:", e.message);
    }
    
    console.log("\n=== CASE B: EXPORT GOODS ===");
    const ctxB = {
        businessId: business.id,
        businessCountryCode: 'IN',
        businessRegionCode: null,
        counterpartyCountryCode: 'US', // Foreign customer
        counterpartyRegionCode: null,
        supplyCategory: 'GOODS', // Product type is mapped to GOODS
        counterpartyTaxRegistrationStatus: 'UNREGISTERED',
        transactionType: 'INVOICE',
        transactionDate: new Date(),
        txClient: prisma
    };
    
    const { txClient: _, ...logCtxB } = ctxB;
    console.log("CONTEXT B:", JSON.stringify(logCtxB, null, 2));
    const placeOfSupplyB = TaxResolver.determinePlaceOfSupply(ctxB);
    console.log("DETERMINED PLACE OF SUPPLY B:", placeOfSupplyB);
    
    try {
        const resolvedB = await TaxResolver.resolveTaxRule(ctxB);
        console.log("RESOLVED RULE B:", resolvedB.name);
    } catch (e) {
        console.error("RESOLVE B FAILED:", e.message);
    }
    
    // Case C context (Domestic Services Reverse Charge)
    console.log("\n=== CASE C: DOMESTIC SERVICES (REVERSE CHARGE) ===");
    const ctxC = {
        businessId: business.id,
        businessCountryCode: 'IN',
        businessRegionCode: null,
        counterpartyCountryCode: 'IN', // Domestic vendor
        counterpartyRegionCode: null,
        supplyCategory: 'SERVICES', // Product type is mapped to SERVICES
        counterpartyTaxRegistrationStatus: 'UNREGISTERED',
        transactionType: 'BILL', // Purchasing from vendor
        transactionDate: new Date(),
        txClient: prisma
    };
    
    const { txClient: __, ...logCtxC } = ctxC;
    console.log("CONTEXT C:", JSON.stringify(logCtxC, null, 2));
    const placeOfSupplyC = TaxResolver.determinePlaceOfSupply(ctxC);
    console.log("DETERMINED PLACE OF SUPPLY C:", placeOfSupplyC);
    
    try {
        const resolvedC = await TaxResolver.resolveTaxRule(ctxC);
        console.log("RESOLVED RULE C:", resolvedC.name);
    } catch (e) {
        console.error("RESOLVE C FAILED:", e.message);
    }

  } finally {
    await prisma.$disconnect();
  }
}
debug();
