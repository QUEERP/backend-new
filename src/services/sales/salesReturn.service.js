const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("./audit.service");
const { generateDocNumber } = require("./quotation.service");
const { getSystemAccounts, postJournalEntries } = require("../ledgerService");

const createSalesReturn = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Generate unique return number
    let returnNumber = await generateDocNumber(tx, businessId, "SR", "salesReturn", "returnNumber");
    returnNumber += `-${Date.now()}`;

    // 2. Fetch original Invoice to extract historical currency/tax rules
    let overrideCurrencyData = null;
    let originalInvoice = null;
    
    if (data.invoiceId) {
      originalInvoice = await tx.invoice.findUnique({
        where: { id: data.invoiceId }
      });
      
      if (originalInvoice) {
        const taxTxs = await tx.taxTransaction.findMany({
            where: { transactionId: originalInvoice.id, transactionType: 'INVOICE' }
        });
        originalInvoice.taxTransactions = taxTxs;
        overrideCurrencyData = {
          transactionCurrencyId: originalInvoice.transactionCurrencyId,
          baseCurrencyId: originalInvoice.baseCurrencyId,
          exchangeRate: originalInvoice.exchangeRate,
          statutoryRate: originalInvoice.statutoryExchangeRate,
          decimals: 2
        };
      }
    }
    
    // Fetch original tax overrides to carry forward
    const historicalOverrides = {};
    if (originalInvoice && originalInvoice.taxTransactions) {
       for (const tt of originalInvoice.taxTransactions) {
           historicalOverrides[tt.taxRateId || tt.overrideTaxTypeId] = {
               isManualOverride: !!tt.overrideTaxTypeId,
               manualOverrideRate: tt.overrideRate,
               manualOverrideReason: tt.overrideReason,
               overrideTaxTypeId: tt.overrideTaxTypeId
           };
       }
    }

    const TransactionHelper = require("../TransactionHelper");
    const mappedItems = data.items.map(item => {
        const matchedOverride = historicalOverrides[item.taxRateId]; // naive match
        return {
           ...item,
           isManualOverride: item.isManualOverride || (matchedOverride && matchedOverride.isManualOverride),
           manualOverrideRate: item.manualOverrideRate || (matchedOverride && matchedOverride.manualOverrideRate),
           overrideTaxTypeId: item.overrideTaxTypeId || (matchedOverride && matchedOverride.overrideTaxTypeId),
           manualOverrideReason: item.manualOverrideReason || (matchedOverride && matchedOverride.manualOverrideReason) || "Carry-forward from original invoice"
        };
    });

    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate: new Date(),
      currencyCode: originalInvoice ? originalInvoice.currency : (data.currency || 'AED'), // fallback
      items: mappedItems,
      customerId: data.customerId,
      transactionType: 'SALES_RETURN',
      overrideCurrencyData,
      txClient: tx,
      userId
    });

    let totalInventoryCost = 0;
    const processedItems = await Promise.all(mappedItems.map(async (item, index) => {
      const qty = Number(item.quantity || 0);
      const prc = Number(item.price || 0);

      const baseAmount = qty * prc;
      // Extract tax from financials
      const itemTxs = financials.taxTransactions.filter(t => t.itemReference === (item.productId || item.description || `item-${index}`));
      const itemTaxAmount = itemTxs.reduce((sum, t) => sum + t.taxAmountTxnCcy, 0);
      const total = baseAmount + itemTaxAmount;

      let originalUnitCost = 0;
      if (data.invoiceId && item.productId) {
        const originalInvoiceItem = await tx.invoiceItem.findFirst({
          where: { invoiceId: data.invoiceId, productId: item.productId }
        });
        if (originalInvoiceItem) {
          originalUnitCost = originalInvoiceItem.unitCost || 0;
        }
      }

      if (item.isStockReturned) {
        totalInventoryCost += qty * originalUnitCost;
      }

      return {
        productId: item.productId,
        description: item.description,
        quantity: qty,
        price: prc,
        total,
        warehouseId: item.warehouseId || null,
        isStockReturned: item.isStockReturned || false
      };
    }));

    const totalAmount = financials.subtotal + financials.totalTax;

    // 3. Create Sales Return
    const salesReturn = await tx.salesReturn.create({
      data: {
        businessId,
        customerId: data.customerId,
        invoiceId: data.invoiceId || null,
        salesOrderId: data.salesOrderId || null,
        returnNumber,
        status: "RECEIVED",
        reason: data.reason || null,
        refundStatus: "CREDIT_NOTE_ISSUED",
        subtotal: financials.subtotal,
        tax: financials.totalTax,
        totalAmount,
        items: {
          create: processedItems
        }
      },
      include: {
        items: true,
        customer: true
      }
    });

    // 4. Return Stock to physical warehouse inventory if designated as returned
    for (const item of processedItems) {
      if (item.productId && item.warehouseId && item.isStockReturned) {
        const stockRecord = await tx.stock.findFirst({
          where: {
            productId: item.productId,
            warehouseId: item.warehouseId
          }
        });

        if (stockRecord) {
          await tx.stock.update({
            where: { id: stockRecord.id },
            data: {
              quantity: {
                increment: item.quantity
              }
            }
          });
        } else {
          // Create stock record inside that warehouse if not exists
          await tx.stock.create({
            data: {
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: item.quantity,
              reservedQty: 0
            }
          });
        }
      }
    }

    // 5. Automatically issue Credit Note for returned amount
    let creditNumber = await generateDocNumber(tx, businessId, "CN", "creditNote", "creditNumber");
    creditNumber += `-${Date.now()}`;
    const creditNote = await tx.creditNote.create({
      data: {
        businessId,
        customerId: data.customerId,
        invoiceId: data.invoiceId || null,
        salesReturnId: salesReturn.id,
        creditNumber,
        type: "INVOICE",
        amount: totalAmount,
        remainingAmount: totalAmount,
        reason: `Sales return ${returnNumber} credit adjustment`,
        status: "OPEN",
        currency: originalInvoice ? originalInvoice.currency : (data.currency || 'AED'),
        transactionCurrencyId: financials.currencyData.transactionCurrencyId,
        baseCurrencyId: financials.currencyData.baseCurrencyId,
        exchangeRate: financials.currencyData.exchangeRate,
        statutoryExchangeRate: financials.currencyData.statutoryRate,
        statutoryBaseAmount: financials.totalTax
      }
    });

    // Delegated Tax Transaction write to the CreditNote ownership
    await TransactionHelper.saveTaxLedger(
      tx,
      businessId,
      'CREDIT_NOTE',
      creditNote.id,
      financials.taxTransactions
    );

    // 6. Log Audit Trail & Notification
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "SALES_RETURN_CREATED",
      entityType: "SalesReturn",
      entityId: salesReturn.id,
      details: { returnNumber, totalAmount, creditNoteNumber: creditNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Sales Return Logged",
      message: `Return ${returnNumber} accepted. Stock returned. Credit Note ${creditNumber} issued.`,
      type: "SUCCESS",
      entityType: "SalesReturn",
      entityId: salesReturn.id
    });

    // 8. POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    const journalEntries = [
      // Leg 1: Sales Return
      { businessId, accountId: accounts.SYSTEM_SALES_RETURN, debit: totalAmount, credit: 0, description: `Sales Return ${returnNumber}` },
      { businessId, accountId: accounts.SYSTEM_AR, debit: 0, credit: totalAmount, description: `Sales Return ${returnNumber}` }
    ];

    // Leg 2: Inventory Reversal
    if (totalInventoryCost > 0) {
      journalEntries.push(
        { businessId, accountId: accounts.SYSTEM_INVENTORY, debit: totalInventoryCost, credit: 0, description: `Inventory Reversal for Sales Return ${returnNumber}` },
        { businessId, accountId: accounts.SYSTEM_COGS, debit: 0, credit: totalInventoryCost, description: `COGS Reversal for Sales Return ${returnNumber}` }
      );
    }
    
    await postJournalEntries(tx, journalEntries);

    return { salesReturn, creditNote };
  }, { maxWait: 20000, timeout: 30000 });
};

const getSalesReturnsByBusiness = async (businessId) => {
  return await prisma.salesReturn.findMany({
    where: { businessId },
    include: {
      items: true,
      customer: true,
      invoice: true,
      creditNotes: true
    },
    orderBy: { createdAt: "desc" }
  });
};

const getSalesReturnById = async (businessId, id) => {
  const sr = await prisma.salesReturn.findFirst({
    where: { id, businessId },
    include: {
      items: true,
      customer: true,
      invoice: true,
      creditNotes: true
    }
  });
  if (!sr) {
    throw new Error("Sales Return not found");
  }
  return sr;
};

module.exports = {
  createSalesReturn,
  getSalesReturnsByBusiness,
  getSalesReturnById
};
