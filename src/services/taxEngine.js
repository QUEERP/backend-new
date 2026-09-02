const prisma = require('../config/prisma');
const { RateResolutionError } = require('./currencyService');

const TaxResolver = require('./TaxResolver');

class TaxEngine {
  /**
   * Calculates dynamic tax and generates TaxTransaction payloads based on data-driven TaxRules.
   */
  static async calculateTax(params) {
    const { 
      businessId, 
      businessCountryCode,
      businessRegionCode,
      counterpartyCountryCode,
      counterpartyRegionCode,
      supplyCategory = 'GOODS',
      counterpartyTaxRegistrationStatus,
      transactionType,
      lineSubtotal, 
      exchangeRate = 1.0, 
      statutoryRate = 1.0, 
      decimals = 2,
      transactionDate = new Date(),
      isManualOverride = false,
      manualOverrideRate = null,
      manualOverrideReason = null,
      overrideTaxTypeId = null,
      userId = null,
      txClient = prisma
    } = params;

    if (!lineSubtotal) {
      return [];
    }

    const business = await txClient.business.findUnique({
      where: { id: businessId },
      include: { taxFramework: true }
    });

    if (!business || !business.taxFrameworkId) {
      return [];
    }

    let taxRuleId;
    let taxRateId;
    
    if (isManualOverride) {
      if (!overrideTaxTypeId) {
        throw new RateResolutionError("Manual tax overrides must specify a valid overrideTaxTypeId.");
      }
      if (manualOverrideRate === null || manualOverrideRate === undefined) {
         throw new RateResolutionError("Manual tax overrides must specify a manualOverrideRate.");
      }
      if (!manualOverrideReason) {
         throw new RateResolutionError("Manual tax overrides must specify an overrideReason.");
      }
      if (!userId) {
         throw new RateResolutionError("Manual tax overrides must be performed by an authenticated user (userId missing).");
      }
      
      const validTaxType = await txClient.taxType.findFirst({
        where: { 
          id: overrideTaxTypeId, 
          taxFrameworkId: business.taxFrameworkId 
        }
      });
      if (!validTaxType) {
        throw new RateResolutionError("Invalid or unauthorized tax type override.");
      }
      
      const taxAmountTxnCcy = Number(((lineSubtotal * manualOverrideRate) / 100).toFixed(decimals));
      
      // Directly return the overridden transaction without going through rule resolution
      return [{
        taxRateId: null,
        isManualOverride: true,
        overrideRate: manualOverrideRate,
        overrideReason: manualOverrideReason,
        overrideTaxTypeId: overrideTaxTypeId,
        overriddenBy: userId, // Assuming userId is passed in context
        overriddenAt: new Date(),
        taxAmountTxnCcy,
        taxAmountBaseCcy: Number((taxAmountTxnCcy * exchangeRate).toFixed(decimals)),
        taxableAmountBaseCcy: Number((lineSubtotal * exchangeRate).toFixed(decimals)),
        taxAmountStatutoryCcy: Number((taxAmountTxnCcy * statutoryRate).toFixed(decimals))
      }];
    } else {
      const resolved = await TaxResolver.resolveTaxRule({
         businessId,
         businessCountryCode,
         businessRegionCode,
         counterpartyCountryCode,
         counterpartyRegionCode,
         supplyCategory,
         counterpartyTaxRegistrationStatus,
         transactionType,
         transactionDate,
         txClient
      });
      taxRuleId = resolved.taxRuleId;
      taxRateId = resolved.taxRateId;
    }

    if (!taxRuleId) return [];

    // 3. Fetch active TaxRates belonging strictly to this TaxRule
    const activeRates = await txClient.taxRate.findMany({
      where: {
        taxRuleId: taxRuleId,
        effectiveFrom: { lte: transactionDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: transactionDate } }
        ]
      }
    });

    if (activeRates.length === 0) {
      throw new RateResolutionError(`TaxRule ID '${taxRuleId}' has no active TaxRates on or before ${transactionDate.toISOString()}`);
    }

    // 4. Validation against requested taxPercent is removed because the rate is now resolved server-side.
    const totalRate = activeRates.reduce((sum, r) => sum + r.rate, 0);

    const applicableRates = activeRates;

    // 5. Generate TaxTransaction objects using the consistent decimals
    const transactions = applicableRates.map(rateObj => {
      const taxAmountTxnCcy = Number(((lineSubtotal * rateObj.rate) / 100).toFixed(decimals));
      
      return {
        taxRateId: rateObj.id,
        taxAmountTxnCcy,
        taxAmountBaseCcy: Number((taxAmountTxnCcy * exchangeRate).toFixed(decimals)),
        taxableAmountBaseCcy: Number((lineSubtotal * exchangeRate).toFixed(decimals)),
        taxAmountStatutoryCcy: Number((taxAmountTxnCcy * statutoryRate).toFixed(decimals))
      };
    });

    return transactions;
  }

  /**
   * Projects an array of generated TaxTransactions back into the legacy flat schema 
   * (cgst, sgst, igst, vatAmount) for dual-write compatibility.
   * Handles empty arrays without erroring.
   * 
   * @param {Array} taxTransactions 
   * @param {Object} taxRatesMap (Mapping of rate ID to Name)
   * @returns {Object} { cgst, sgst, igst, vatAmount }
   */
  static projectToLegacyFields(taxTransactions, taxRatesMap) {
    const legacy = { cgst: 0, sgst: 0, igst: 0, vatAmount: 0 };

    if (!taxTransactions || taxTransactions.length === 0) {
      return legacy; // Safe exit for zero tax rows (tax-exempt)
    }

    for (const tx of taxTransactions) {
      const rateName = taxRatesMap[tx.taxRateId]?.toUpperCase() || '';
      
      if (rateName.includes('CGST')) legacy.cgst += tx.taxAmountTxnCcy;
      else if (rateName.includes('SGST')) legacy.sgst += tx.taxAmountTxnCcy;
      else if (rateName.includes('IGST')) legacy.igst += tx.taxAmountTxnCcy;
      else if (rateName.includes('VAT')) legacy.vatAmount += tx.taxAmountTxnCcy;
    }

    return legacy;
  }
}

module.exports = TaxEngine;
