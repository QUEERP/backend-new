const prisma = require('../config/prisma');
const { CurrencyService } = require('./currencyService');
const TaxEngine = require('./taxEngine');

class TransactionHelper {
  /**
   * Centralized helper to process cross-currency and multi-tax logic for any transaction type.
   */
  static async processTransactionFinancials({ businessId, transactionDate, currencyCode, items, customerId, globalDiscount = 0, overrideCurrencyData, txClient }) {
     const tx = txClient || prisma;
     
     // 1. Resolve Exchange Rates (Use override if provided, else resolve)
     const currencyData = overrideCurrencyData || await CurrencyService.resolveCurrencyData(businessId, currencyCode, transactionDate);
     
     // 2. Fetch jurisdiction states
     const business = await tx.business.findUnique({ where: { id: businessId } });
     let customerState = null;
     if (customerId) {
       const customer = await tx.customer.findUnique({ where: { id: customerId } });
       customerState = customer?.region || customer?.city || null; // fallback if state isn't explicitly defined
     }

     // 3. Fetch tax rates map for legacy projection
     const allRates = await tx.taxRate.findMany();
     const ratesMap = allRates.reduce((acc, r) => ({ ...acc, [r.id]: r.name }), {});

     let grossSubtotal = 0;
     const processedItems = items.map(item => {
       const qty = Number(item.quantity || 0);
       const price = Number(item.price || item.rate || 0);
       const disc = Number(item.discount || 0);
       const itemSubtotal = Math.max((qty * price) - disc, 0);
       grossSubtotal += itemSubtotal;
       return { ...item, itemSubtotal };
     });

     if (globalDiscount > grossSubtotal) {
       throw new Error(`Global discount (${globalDiscount}) cannot exceed gross subtotal (${grossSubtotal}).`);
     }

     let largestItemIndex = 0;
     let maxSubtotal = -1;
     let allocatedDiscount = 0;
     
     // First pass: calculate proportional discounts
     const itemDiscounts = processedItems.map((item, idx) => {
       if (item.itemSubtotal > maxSubtotal) {
         maxSubtotal = item.itemSubtotal;
         largestItemIndex = idx;
       }
       
       if (grossSubtotal > 0 && globalDiscount > 0) {
         const d = Number(((item.itemSubtotal / grossSubtotal) * globalDiscount).toFixed(currencyData.decimals));
         allocatedDiscount += d;
         return d;
       }
       return 0;
     });

     // Apply penny-rounding remainder to the largest item
     if (grossSubtotal > 0 && globalDiscount > 0) {
       const remainder = globalDiscount - allocatedDiscount;
       itemDiscounts[largestItemIndex] = Number((itemDiscounts[largestItemIndex] + remainder).toFixed(currencyData.decimals));
     }

     let allTaxTransactions = [];
     
     // 4. Calculate Taxes per line item (using pre-tax apportioned discount)
     for (let i = 0; i < processedItems.length; i++) {
       const item = processedItems[i];
       const proportionalDiscount = itemDiscounts[i];
       
       const netLineSubtotal = Math.max(item.itemSubtotal - proportionalDiscount, 0);
       
       if (item.taxPercent) {
         const itemTaxes = await TaxEngine.calculateTax({
           businessId,
           businessState: business.state,
           customerState,
           lineSubtotal: netLineSubtotal,
           taxPercent: Number(item.taxPercent),
           exchangeRate: currencyData.exchangeRate,
           statutoryRate: currencyData.statutoryRate,
           decimals: currencyData.decimals,
           transactionDate
         });
         allTaxTransactions = allTaxTransactions.concat(itemTaxes);
       }
     }
     
     // 5. Aggregate Results
     const legacyTaxes = TaxEngine.projectToLegacyFields(allTaxTransactions, ratesMap);
     const totalTax = allTaxTransactions.reduce((sum, t) => sum + t.taxAmountTxnCcy, 0);

     return {
       currencyData,
       subtotal: grossSubtotal,
       totalTax,
       legacyTaxes,
       taxTransactions: allTaxTransactions.map(t => ({
         ...t,
         transactionCurrencyId: currencyData.transactionCurrencyId
       }))
     };
  }

  static async saveTaxLedger(tx, businessId, transactionType, transactionId, taxTransactions) {
    if (taxTransactions && taxTransactions.length > 0) {
      await tx.taxTransaction.createMany({
        data: taxTransactions.map(t => ({
          ...t,
          businessId,
          transactionType,
          transactionId
        }))
      });
    }
  }
}

module.exports = TransactionHelper;
