const prisma = require('../config/prisma');
const { CurrencyService } = require('./currencyService');
const TaxEngine = require('./taxEngine');

class TransactionHelper {
  /**
   * Centralized helper to process cross-currency and multi-tax logic for any transaction type.
   */
   static async processTransactionFinancials({ businessId, transactionDate, currencyCode, items, customerId, vendorId, transactionType = 'INVOICE', userId, globalDiscount = 0, overrideCurrencyData, txClient }) {
     const tx = txClient || prisma;
     
     // 1. Resolve Exchange Rates (Use override if provided, else resolve)
     const currencyData = overrideCurrencyData || await CurrencyService.resolveCurrencyData(businessId, currencyCode, transactionDate);
     
     // 2. Fetch jurisdiction states
     const business = await tx.business.findUnique({ where: { id: businessId } });
     let counterpartyCountryCode = null;
     let counterpartyRegionCode = null;
     let counterpartyTaxRegistrationStatus = null;
     
     if (customerId) {
       const customer = await tx.customer.findUnique({ where: { id: customerId } });
       if (customer) {
         counterpartyCountryCode = customer.country || business.countryCode || 'AE';
         counterpartyRegionCode = customer.state || customer.city || null;
         counterpartyTaxRegistrationStatus = customer.vatNumber ? 'REGISTERED' : 'UNREGISTERED';
       }
     } else if (vendorId) {
       const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
       if (vendor) {
         counterpartyCountryCode = vendor.country || business.countryCode || 'AE';
         counterpartyRegionCode = vendor.state || vendor.city || null;
         counterpartyTaxRegistrationStatus = vendor.vatNumber ? 'REGISTERED' : 'UNREGISTERED';
       }
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
       
       // Handle explicit overrides
       const isManualOverride = !!(item.isManualOverride || item.overrideTaxRate !== undefined);
       const manualOverrideRate = isManualOverride ? Number(item.overrideTaxRate || 0) : null;
       const overrideTaxTypeId = isManualOverride ? item.overrideTaxTypeId : null;
       const manualOverrideReason = isManualOverride ? (item.manualOverrideReason || 'Manual adjustment') : null;
       
       if (isManualOverride && userId) {
         const userWithRoles = await tx.user.findUnique({
            where: { id: userId },
            include: { memberships: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } }
         });
         
         let hasOverridePerm = false;
         if (userWithRoles && userWithRoles.memberships) {
            for (const userRole of userWithRoles.memberships) {
               const perms = userRole.role?.rolePermissions || [];
               if (perms.some(p => p.permission.action === 'TAX_OVERRIDE')) {
                  hasOverridePerm = true;
                  break;
               }
            }
         }
         
         if (!hasOverridePerm) {
            throw new Error(`Permission Denied: User ${userId} does not have TAX_OVERRIDE permission to apply manual tax overrides.`);
         }
       }
       
       let supplyCategory = 'GOODS';
       if (item.productId) {
           const product = await tx.product.findUnique({ where: { id: item.productId } });
           const TaxResolver = require('./TaxResolver');
           supplyCategory = TaxResolver.mapItemTypeToSupplyCategory ? TaxResolver.mapItemTypeToSupplyCategory(product?.type) : 'GOODS';
       }

       try {
         const calcContext = {
           businessId,
           businessCountryCode: business.countryCode || 'AE',
           businessRegionCode: business.state || business.city || null,
           counterpartyCountryCode,
           counterpartyRegionCode,
           supplyCategory,
           counterpartyTaxRegistrationStatus,
           transactionType,
           transactionDate,
           txClient: tx
         };
         const TaxResolver = require('./TaxResolver');
         const rA = await TaxResolver.resolveTaxRule(calcContext);
         console.log(`[TransactionHelper] Item ${item.productId} resolved to rule: ${rA.name}`);

         const itemTaxes = await TaxEngine.calculateTax({
           ...calcContext,
           lineSubtotal: netLineSubtotal,
           exchangeRate: currencyData.exchangeRate,
           statutoryRate: currencyData.statutoryRate,
           decimals: currencyData.decimals,
           transactionDate,
           isManualOverride,
           manualOverrideRate,
           manualOverrideReason,
           overrideTaxTypeId,
           userId,
           txClient: tx
         });
         
         allTaxTransactions = allTaxTransactions.concat(itemTaxes);
       } catch (err) {
         throw new Error(`Failed to calculate tax for item ${item.productId || 'UNKNOWN'}: ${err.message}`);
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
