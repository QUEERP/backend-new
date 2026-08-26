const prisma = require('../config/prisma');
const { RateResolutionError } = require('./currencyService');

class TaxEngine {
  /**
   * Calculates dynamic tax and generates TaxTransaction payloads based on data-driven TaxRules.
   * 
   * @param {Object} params
   * @param {string} params.businessId
   * @param {string} params.businessState
   * @param {string} params.customerState
   * @param {number} params.lineSubtotal
   * @param {number} params.taxPercent
   * @param {number} params.exchangeRate
   * @param {number} params.statutoryRate
   * @param {number} params.decimals - the decimals returned by currencyService for proper base scaling
   * @param {string} params.transactionDate
   * @returns {Promise<Array>} Array of TaxTransaction data objects (unpersisted)
   */
  static async calculateTax(params) {
    const { 
      businessId, 
      businessState,
      customerState,
      lineSubtotal, 
      taxPercent, 
      exchangeRate = 1.0, 
      statutoryRate = 1.0, 
      decimals = 2,
      transactionDate = new Date() 
    } = params;

    if (!taxPercent || taxPercent <= 0 || !lineSubtotal) {
      return [];
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { taxFramework: true }
    });

    if (!business || !business.taxFrameworkId) {
      if (taxPercent > 0) {
        throw new RateResolutionError(`Business ${businessId} is missing a TaxFramework setup, but tax of ${taxPercent}% was requested.`);
      }
      return [];
    }

    // 1. Determine Jurisdiction for Rule Matching (Data-driven replacement for India hardcoding)
    // If the ERP has states for both, determine if it's an intra-state or inter-state transaction.
    // If no states are provided or applicable (like UAE), it will match generic country rules.
    let targetJurisdiction = null;
    if (businessState && customerState) {
      targetJurisdiction = (businessState.trim().toLowerCase() === customerState.trim().toLowerCase()) 
        ? 'INTRASTATE' 
        : 'INTERSTATE';
    }

    // 2. Fetch the matching TaxRule for this business
    // We look for a rule that matches the requested taxPercent and the jurisdiction.
    // Fallback to rules with no specific jurisdiction if a strict state match isn't found.
    let taxRule = null;
    if (targetJurisdiction) {
      taxRule = await prisma.taxRule.findFirst({
        where: { businessId, rate: taxPercent, jurisdiction: targetJurisdiction }
      });
    }

    if (!taxRule) {
      taxRule = await prisma.taxRule.findFirst({
        where: { businessId, rate: taxPercent }
      });
    }

    if (!taxRule) {
      throw new RateResolutionError(`No matching TaxRule found for jurisdiction ${targetJurisdiction || 'ANY'} and rate ${taxPercent}%`);
    }

    // 3. Fetch active TaxRates belonging strictly to this TaxRule
    const activeRates = await prisma.taxRate.findMany({
      where: {
        taxRuleId: taxRule.id,
        effectiveFrom: { lte: transactionDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: transactionDate } }
        ]
      }
    });

    if (activeRates.length === 0) {
      throw new RateResolutionError(`TaxRule '${taxRule.name}' has no active TaxRates on or before ${transactionDate.toISOString()}`);
    }

    // 4. Validate that the sum of the active rates exactly matches the requested taxPercent
    const totalRate = activeRates.reduce((sum, r) => sum + r.rate, 0);
    if (Math.abs(totalRate - taxPercent) > 0.001) {
      throw new RateResolutionError(`Active TaxRates for rule '${taxRule.name}' sum to ${totalRate}%, which does not match requested ${taxPercent}%`);
    }

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
