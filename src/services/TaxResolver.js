const prisma = require('../config/prisma');
const { RateResolutionError } = require('./currencyService'); // Or throw standard Error

class TaxResolver {
  static mapItemTypeToSupplyCategory(productType) {
    return productType === 'SERVICE' ? 'SERVICES' : 'GOODS';
  }

  /**
   * Determine the effective Place of Supply
   */
  static determinePlaceOfSupply(context) {
    const { 
      businessCountryCode, businessRegionCode, 
      counterpartyCountryCode, counterpartyRegionCode, 
      placeOfSupplySource = 'CUSTOMER_LOCATION',
      transactionType
    } = context;
    
    let targetCountry = counterpartyCountryCode;
    let targetRegion = counterpartyRegionCode;
    
    // In a real system, placeOfSupplySource might override the target region 
    // (e.g. SERVICE_LOCATION means the service happened at the business, not the customer)
    if (placeOfSupplySource === 'BUSINESS_LOCATION') {
      targetCountry = businessCountryCode;
      targetRegion = businessRegionCode;
    }

    let placeOfSupply = 'DOMESTIC';
    if (businessCountryCode !== targetCountry) {
      // International
      const exportTypes = ['INVOICE', 'CREDIT_NOTE', 'SALES_RETURN'];
      const importTypes = ['BILL', 'DEBIT_NOTE', 'PURCHASE_RETURN', 'GRN', 'PURCHASE'];
      
      if (exportTypes.includes(transactionType)) {
        placeOfSupply = 'EXPORT';
      } else if (importTypes.includes(transactionType)) {
        placeOfSupply = 'IMPORT';
      } else {
        throw new Error(`Tax Resolution Failed: Unrecognized transactionType '${transactionType}' for international supply.`);
      }
    } else {
      // Domestic
      if (businessRegionCode && targetRegion && businessRegionCode !== targetRegion) {
        placeOfSupply = 'INTERSTATE';
      } else if (businessRegionCode && targetRegion && businessRegionCode === targetRegion) {
        placeOfSupply = 'INTRASTATE';
      }
    }

    return { placeOfSupply, targetCountry, targetRegion };
  }

  static async resolveTaxRule(context) {
    const {
      businessId,
      businessCountryCode,
      businessRegionCode,
      supplyCategory = 'GOODS',
      counterpartyTaxRegistrationStatus,
      transactionDate = new Date(),
      txClient = prisma
    } = context;

    const { placeOfSupply, targetCountry, targetRegion } = this.determinePlaceOfSupply(context);

    // Fetch rules for this business
    const rules = await txClient.taxRule.findMany({
      where: { businessId },
      include: { rates: true }
    });

    const activeRules = rules.map(rule => {
      // Find the currently active rate, fallback to rule.rate if no rates relation exists
      const activeRate = rule.rates && rule.rates.length > 0 
        ? rule.rates.find(r => 
            new Date(r.effectiveFrom) <= new Date(transactionDate) && 
            (!r.effectiveTo || new Date(r.effectiveTo) >= new Date(transactionDate))
          )
        : null;
        
      return {
        ...rule,
        resolvedRateId: activeRate ? activeRate.id : null,
        resolvedRateValue: activeRate ? activeRate.rate : rule.rate
      };
    });

    // 1. Must match countryCode (if specified on rule)
    // 2. Must match supplyCategory (if specified on rule)
    // 3. Must match placeOfSupply (if specified on rule)
    // 4. Must match counterpartyTaxRegistrationStatus (if specified)
    
    let matchingRules = activeRules.filter(rule => {
      // A tax rule is generally defined for a specific jurisdiction.
      // For the currently supported scope, the filing jurisdiction is the business's country.
      let filingCountry = businessCountryCode;
      
      // Region is usually destination-based for domestic sales (targetRegion).
      // For international, the business applies its own region's export/import rules.
      let filingRegion = (placeOfSupply === 'EXPORT' || placeOfSupply === 'IMPORT') ? businessRegionCode : targetRegion;

      if (rule.countryCode && rule.countryCode !== filingCountry) return false;
      if (rule.regionCode && rule.regionCode !== filingRegion) return false;
      if (rule.supplyCategory && rule.supplyCategory !== supplyCategory) return false;
      if (rule.placeOfSupply && rule.placeOfSupply !== placeOfSupply) return false;
      if (rule.counterpartyTaxRegistrationStatus && rule.counterpartyTaxRegistrationStatus !== counterpartyTaxRegistrationStatus) return false;
      return true;
    });

    matchingRules.sort((a, b) => a.priority - b.priority);

    if (matchingRules.length === 0) {
      throw new Error(`Tax Resolution Failed: No applicable tax rule found for SupplyCategory=${supplyCategory}, PlaceOfSupply=${placeOfSupply}, RegistrationStatus=${counterpartyTaxRegistrationStatus || 'ANY'}.`);
    }

    const selectedRule = matchingRules[0];
    
    return {
      taxRuleId: selectedRule.id,
      name: selectedRule.name,
      rate: selectedRule.resolvedRateValue,
      type: selectedRule.type,
      isRecoverable: selectedRule.isRecoverable,
      taxRateId: selectedRule.resolvedRateId,
      candidateCount: matchingRules.length,
      evaluatedCount: activeRules.length
    };
  }
}

module.exports = TaxResolver;
