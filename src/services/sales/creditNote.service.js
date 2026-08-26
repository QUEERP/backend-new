const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("./audit.service");
const { generateDocNumber } = require("./quotation.service");
const { getSystemAccounts, postJournalEntries } = require("../ledgerService");
const { CurrencyService } = require("../currencyService");

const TransactionHelper = require("../TransactionHelper");

const createCreditNote = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    const creditNumber = await generateDocNumber(tx, businessId, "CN", "creditNote", "creditNumber");

    let overrideCurrencyData = null;
    let originalInvoice = null;

    if (data.invoiceId) {
      originalInvoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, businessId }
      });
      if (originalInvoice) {
        // Use historical exchange rates from the original invoice
        overrideCurrencyData = {
          transactionCurrencyId: originalInvoice.transactionCurrencyId,
          baseCurrencyId: originalInvoice.baseCurrencyId,
          exchangeRate: originalInvoice.exchangeRate,
          statutoryRate: originalInvoice.statutoryExchangeRate,
          decimals: 2 // We can assume 2 or fetch from currency, but CurrencyService.resolveCurrencyData uses 2 mostly, let's fetch to be safe
        };
        const tCur = await tx.currency.findUnique({ where: { id: originalInvoice.transactionCurrencyId } });
        if (tCur) overrideCurrencyData.decimals = tCur.decimals || 2;
      }
    }

    const transactionDate = data.date ? new Date(data.date) : new Date();
    const discount = Number(data.discount || 0);

    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate,
      currencyCode: data.currency || (originalInvoice ? originalInvoice.currency : "AED"),
      items: data.items || [],
      customerId: data.customerId || (originalInvoice ? originalInvoice.customerId : null),
      globalDiscount: discount,
      overrideCurrencyData,
      txClient: tx
    });

    const grandTotal = financials.subtotal + financials.totalTax - discount;

    const creditNote = await tx.creditNote.create({
      data: {
        businessId,
        customerId: data.customerId || (originalInvoice ? originalInvoice.customerId : null),
        invoiceId: data.invoiceId || null,
        vendorId: data.vendorId || null,
        salesReturnId: data.salesReturnId || null,
        creditNumber,
        type: data.type || "INVOICE",
        amount: grandTotal,
        remainingAmount: grandTotal,
        reason: data.reason || null,
        status: "OPEN",
        
        // Currency Fields
        currency: data.currency || (originalInvoice ? originalInvoice.currency : "AED"),
        transactionCurrencyId: financials.currencyData.transactionCurrencyId,
        baseCurrencyId: financials.currencyData.baseCurrencyId,
        exchangeRate: financials.currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
        statutoryExchangeRate: financials.currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals)
      }
    });

    await TransactionHelper.saveTaxLedger(tx, businessId, "CREDIT_NOTE", creditNote.id, financials.taxTransactions);

    // POST TO LEDGER
    // A Credit Note reverses the AR and Revenue/Tax legs of an Invoice.
    const accounts = await getSystemAccounts(tx, businessId);
    
    const taxAmountBaseCcy = CurrencyService.scaleAmount(financials.totalTax, financials.currencyData.exchangeRate, financials.currencyData.decimals);
    const grandTotalBaseCcy = creditNote.baseCurrencyAmount;
    
    // Plug technique: derive revenue reversal to guarantee perfectly balanced journal entries
    const netRevenueBaseCcy = grandTotalBaseCcy - taxAmountBaseCcy;
    const invoiceRate = financials.currencyData.exchangeRate;

    const journalEntries = [
      // Leg 1: Reversing AR and Revenue
      { businessId, accountId: accounts.SYSTEM_REVENUE, debit: (financials.subtotal - discount), credit: 0, baseDebit: netRevenueBaseCcy, baseCredit: 0, description: `Credit Note #${creditNumber} (Net Revenue Reversal)`, exchangeRate: invoiceRate },
      { businessId, accountId: accounts.SYSTEM_AR, debit: 0, credit: grandTotal, baseDebit: 0, baseCredit: grandTotalBaseCcy, description: `Credit Note #${creditNumber}`, exchangeRate: invoiceRate }
    ];

    if (taxAmountBaseCcy > 0) {
      // Debit Tax Payable (reducing liability)
      journalEntries.push({ businessId, accountId: accounts.SYSTEM_TAX_PAYABLE, debit: financials.totalTax, credit: 0, baseDebit: taxAmountBaseCcy, baseCredit: 0, description: `Credit Note #${creditNumber} (Tax Reversal)`, exchangeRate: invoiceRate });
    }

    await postJournalEntries(tx, journalEntries);

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "CREDIT_NOTE_CREATED",
      entityType: "CreditNote",
      entityId: creditNote.id,
      details: { creditNumber, amount: creditNote.amount }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Credit Note Generated",
      message: `Credit Note ${creditNumber} of amount ${creditNote.amount} has been issued.`,
      type: "SUCCESS",
      entityType: "CreditNote",
      entityId: creditNote.id
    });

    return creditNote;
  }, { timeout: 30000, maxWait: 30000 });
};

const getCreditNotesByBusiness = async (businessId, customerId = undefined) => {
  const where = { businessId, isDeleted: false };
  if (customerId) {
    where.customerId = customerId;
  }
  return await prisma.creditNote.findMany({
    where,
    include: {
      customer: true,
      invoice: true,
      salesReturn: true
    },
    orderBy: { createdAt: "desc" },
    take: 500
  });
};

const getCreditNoteById = async (businessId, id) => {
  const cn = await prisma.creditNote.findFirst({
    where: { id, businessId, isDeleted: false },
    include: {
      customer: true,
      invoice: true,
      salesReturn: true
    }
  });
  if (!cn) {
    throw new Error("Credit Note not found");
  }
  return cn;
};

const deleteCreditNote = async (businessId, userId, userEmail, id) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.creditNote.findFirst({
      where: { id, businessId, isDeleted: false }
    });
    if (!existing) {
      throw new Error("Credit Note not found");
    }

    await tx.creditNote.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "CREDIT_NOTE_DELETED",
      entityType: "CreditNote",
      entityId: id,
      details: { creditNumber: existing.creditNumber }
    });

    return true;
  });
};

const applyCreditNote = async (businessId, userId, userEmail, id, invoiceId, amountToApply) => {
  return await prisma.$transaction(async (tx) => {
    const cn = await tx.creditNote.findFirst({ where: { id, businessId, isDeleted: false } });
    if (!cn) throw new Error("Credit Note not found");
    if (cn.remainingAmount < amountToApply) throw new Error("Insufficient credit note balance");

    // Update CN
    const remaining = cn.remainingAmount - amountToApply;
    await tx.creditNote.update({
      where: { id },
      data: {
        remainingAmount: remaining,
        status: remaining === 0 ? "SETTLED" : "OPEN"
      }
    });

    // POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    const journalEntries = [
      { businessId, accountId: accounts.SYSTEM_CUSTOMER_ADVANCE, debit: amountToApply, credit: 0, description: `Credit Note ${cn.creditNumber} applied to invoice` },
      { businessId, accountId: accounts.SYSTEM_AR, debit: 0, credit: amountToApply, description: `Credit Note ${cn.creditNumber} applied to invoice` }
    ];
    await postJournalEntries(tx, journalEntries);

    await logAction(tx, {
      businessId, userId, userEmail, action: "CREDIT_NOTE_APPLIED",
      entityType: "CreditNote", entityId: id, details: { creditNumber: cn.creditNumber, amountApplied: amountToApply }
    });

    return { success: true };
  });
};

const refundCreditNote = async (businessId, userId, userEmail, id, amountToRefund) => {
  return await prisma.$transaction(async (tx) => {
    const cn = await tx.creditNote.findFirst({ where: { id, businessId, isDeleted: false } });
    if (!cn) throw new Error("Credit Note not found");
    if (cn.remainingAmount < amountToRefund) throw new Error("Insufficient credit note balance");

    const remaining = cn.remainingAmount - amountToRefund;
    await tx.creditNote.update({
      where: { id },
      data: {
        remainingAmount: remaining,
        status: remaining === 0 ? "REFUNDED" : "OPEN"
      }
    });

    // POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    const journalEntries = [
      { businessId, accountId: accounts.SYSTEM_CUSTOMER_ADVANCE, debit: amountToRefund, credit: 0, description: `Credit Note ${cn.creditNumber} refunded to customer` },
      { businessId, accountId: accounts.SYSTEM_CASH, debit: 0, credit: amountToRefund, description: `Credit Note ${cn.creditNumber} refunded to customer` }
    ];
    await postJournalEntries(tx, journalEntries);

    await logAction(tx, {
      businessId, userId, userEmail, action: "CREDIT_NOTE_REFUNDED",
      entityType: "CreditNote", entityId: id, details: { creditNumber: cn.creditNumber, amountRefunded: amountToRefund }
    });

    return { success: true };
  });
};

module.exports = {
  createCreditNote,
  getCreditNotesByBusiness,
  getCreditNoteById,
  deleteCreditNote,
  applyCreditNote,
  refundCreditNote
};
