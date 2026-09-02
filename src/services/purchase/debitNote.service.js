const prisma = require('../../config/prisma');
const TransactionHelper = require('../TransactionHelper');

class DebitNoteService {
  async createDebitNote(businessId, data, userId) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch original Bill to extract historical currency/tax rules
      let overrideCurrencyData = null;
      let originalBill = null;
      
      if (data.billId) {
        originalBill = await tx.bill.findUnique({
          where: { id: data.billId }
        });
        
        if (originalBill) {
          const taxTransactions = await tx.taxTransaction.findMany({
            where: { transactionId: data.billId, transactionType: 'BILL' }
          });
          originalBill.taxTransactions = taxTransactions;
          overrideCurrencyData = {
            transactionCurrencyId: originalBill.transactionCurrencyId,
            baseCurrencyId: originalBill.baseCurrencyId,
            exchangeRate: originalBill.exchangeRate,
            statutoryRate: originalBill.statutoryExchangeRate,
            decimals: 2
          };
        }
      }
      
      // 2. Fetch original tax overrides to carry forward to reversal
      const historicalOverrides = {};
      if (originalBill && originalBill.taxTransactions) {
         for (const tt of originalBill.taxTransactions) {
             // Match by itemReference instead of taxRateId since overrides have null taxRateId
             if (tt.itemReference) {
                 historicalOverrides[tt.itemReference] = {
                     isManualOverride: !!tt.overrideTaxTypeId,
                     manualOverrideRate: tt.overrideRate,
                     manualOverrideReason: tt.overrideReason,
                     overrideTaxTypeId: tt.overrideTaxTypeId
                 };
             }
         }
      }

      // 3. Process Financials using Tax Engine
      const mappedItems = data.items.map((item, index) => {
          // Attempt to match by itemReference which was built from productId or description or index
          const reference = item.productId || item.description || `item-${index}`;
          const matchedOverride = historicalOverrides[reference];
          
          return {
             ...item,
             isManualOverride: item.isManualOverride || (matchedOverride && matchedOverride.isManualOverride),
             manualOverrideRate: item.manualOverrideRate || (matchedOverride && matchedOverride.manualOverrideRate),
             overrideTaxTypeId: item.overrideTaxTypeId || (matchedOverride && matchedOverride.overrideTaxTypeId),
             overrideReason: item.overrideReason || (matchedOverride && matchedOverride.manualOverrideReason) || "Carry-forward from original bill"
          };
      });

      const financials = await TransactionHelper.processTransactionFinancials({
        businessId,
        transactionDate: data.date,
        currencyCode: data.currency,
        items: mappedItems,
        vendorId: data.vendorId,
        transactionType: 'DEBIT_NOTE',
        overrideCurrencyData,
        txClient: tx,
        userId
      });

      // 4. Create the Debit Note
      const debitNote = await tx.debitNote.create({
        data: {
          businessId,
          vendorId: data.vendorId,
          billId: data.billId,
          debitNumber: data.debitNumber,
          amount: financials.subtotal + financials.totalTax,
          remainingAmount: financials.subtotal + financials.totalTax,
          currency: data.currency,
          transactionCurrencyId: financials.currencyData.transactionCurrencyId,
          baseCurrencyId: financials.currencyData.baseCurrencyId,
          exchangeRate: financials.currencyData.exchangeRate,
          statutoryExchangeRate: financials.currencyData.statutoryRate,
          status: 'OPEN'
        }
      });

      // 5. Save Tax Ledger
      await TransactionHelper.saveTaxLedger(
        tx,
        businessId,
        'DEBIT_NOTE',
        debitNote.id,
        financials.taxTransactions
      );
      
      return debitNote;
    });
  }
}

module.exports = new DebitNoteService();
