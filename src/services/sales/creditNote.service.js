const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("./audit.service");
const { generateDocNumber } = require("./quotation.service");
const { getSystemAccounts, postJournalEntries } = require("../ledgerService");

const createCreditNote = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    const creditNumber = await generateDocNumber(tx, businessId, "CN", "creditNote", "creditNumber");

    const creditNote = await tx.creditNote.create({
      data: {
        businessId,
        customerId: data.customerId || null,
        invoiceId: data.invoiceId || null,
        vendorId: data.vendorId || null,
        salesReturnId: data.salesReturnId || null,
        creditNumber,
        type: data.type || "INVOICE",
        amount: Number(data.amount || 0),
        remainingAmount: Number(data.amount || 0),
        reason: data.reason || null,
        status: "OPEN"
      }
    });

    // Note: No blanket ledger entry here. 
    // Credit notes sit as an outstanding liability until applied or refunded.

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
  });
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
