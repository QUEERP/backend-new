const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("./audit.service");
const { generateDocNumber } = require("./quotation.service");
const { getSystemAccounts, postJournalEntries } = require("../ledgerService");
const { CurrencyService } = require("../currencyService");

const createPayment = async (businessId, userId, userEmail, invoiceId, data) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Invoice
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId, isDeleted: false },
      include: { payments: true }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "PAID") {
      throw new Error("Invoice is already fully paid.");
    }

    // 2. Calculate remaining dues
    const previousPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remaining = Math.max(Number(invoice.grandTotal || 0) - previousPaid, 0);

    const paymentAmount = Number(data.amount || 0);
    const totalPaid = previousPaid + paymentAmount;
    const overpaidAmount = Math.max(paymentAmount - remaining, 0);

    // 3. Generate unique payment number
    const paymentNumber = await generateDocNumber(tx, businessId, "PAY", "payment", "paymentNumber");

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    const currencyCode = data.currency || "AED";
    const currencyData = await CurrencyService.resolveCurrencyData(businessId, currencyCode, paymentDate);

    // 4. Create Payment Record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        invoiceId,
        businessId,
        amount: paymentAmount,
        paymentDate,
        paymentMode: data.paymentMode || "CASH",
        transactionId: data.transactionId || null,
        note: data.note || null,
        createdBy: userId,
        
        // Currency Fields
        currency: currencyCode,
        transactionCurrencyId: currencyData.transactionCurrencyId,
        baseCurrencyId: currencyData.baseCurrencyId,
        exchangeRate: currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.exchangeRate, currencyData.decimals),
        statutoryExchangeRate: currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.statutoryRate, currencyData.decimals)
      }
    });

    // 5. If overpaid, create a Credit Note automatically
    let creditNote = null;
    if (overpaidAmount > 0) {
      const creditNumber = await generateDocNumber(tx, businessId, "CN", "creditNote", "creditNumber");
      creditNote = await tx.creditNote.create({
        data: {
          businessId,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          creditNumber,
          type: "INVOICE",
          amount: overpaidAmount,
          remainingAmount: overpaidAmount,
          reason: `Overpayment for invoice ${invoice.invoiceNumber}`,
          status: "OPEN",
          
          // Currency Fields from payment
          currency: currencyCode,
          transactionCurrencyId: currencyData.transactionCurrencyId,
          baseCurrencyId: currencyData.baseCurrencyId,
          exchangeRate: currencyData.exchangeRate,
          baseCurrencyAmount: CurrencyService.scaleAmount(overpaidAmount, currencyData.exchangeRate, currencyData.decimals),
          statutoryExchangeRate: currencyData.statutoryRate,
          statutoryBaseAmount: CurrencyService.scaleAmount(overpaidAmount, currencyData.statutoryRate, currencyData.decimals)
        }
      });
    }

    if (data.creditNoteId) {
      const cnToSettle = await tx.creditNote.findFirst({
        where: { id: data.creditNoteId, businessId }
      });
      if (cnToSettle) {
        await tx.creditNote.update({
          where: { id: cnToSettle.id },
          data: { status: "SETTLED", remainingAmount: 0 }
        });
      }
    }

    // 6. Update Invoice Status
    let status = "UNPAID";
    if (totalPaid === 0) {
      status = "UNPAID";
    } else if (totalPaid < Number(invoice.grandTotal || 0)) {
      status = "PARTIALLY_PAID";
    } else {
      status = "PAID";
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status }
    });

    if (invoice.projectId) {
      await tx.project.update({
        where: { id: invoice.projectId },
        data: { collectedRevenue: { increment: paymentAmount } }
      });
    }

    // 6.5 POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    
    // We already derived the base currency amounts using the resolved exchange rate.
    // We pass explicit baseDebit/baseCredit to ledger to avoid rounding drift, while logging the actual rate.
    const paymentRate = currencyData.exchangeRate;
    const invoiceRate = Number(invoice.exchangeRate) || paymentRate; // Fallback if invoice doesn't have it

    const paymentAmountBaseCcy = payment.baseCurrencyAmount;
    const overpaidAmountBaseCcy = creditNote ? creditNote.baseCurrencyAmount : 0;
    const arCreditBaseCcy = paymentAmountBaseCcy - overpaidAmountBaseCcy;

    const journalEntries = [
      // Debit: Cash/Bank for the full amount received
      { businessId, accountId: accounts.SYSTEM_CASH, debit: paymentAmount, credit: 0, baseDebit: paymentAmountBaseCcy, baseCredit: 0, description: `Payment Received ${paymentNumber} for Invoice #${invoice.invoiceNumber}`, exchangeRate: paymentRate },
    ];

    // Credit: Accounts Receivable (up to the remaining balance)
    const arCredit = paymentAmount - overpaidAmount;
    if (arCredit > 0) {
      // Historical Invoice AR Base Value
      const historicalARCreditBaseCcy = CurrencyService.scaleAmount(arCredit, invoiceRate, currencyData.decimals);
      
      journalEntries.push({ businessId, accountId: accounts.SYSTEM_AR, debit: 0, credit: arCredit, baseDebit: 0, baseCredit: historicalARCreditBaseCcy, description: `Payment Applied ${paymentNumber} for Invoice #${invoice.invoiceNumber}`, exchangeRate: invoiceRate });
      
      if (arCreditBaseCcy > historicalARCreditBaseCcy) {
        // FX Gain/Loss is a derived base-currency amount, so we pass it explicitly with rate 1.0 since it's a variance
        journalEntries.push({ businessId, accountId: accounts.SYSTEM_FX_GAIN_LOSS, debit: 0, credit: (arCreditBaseCcy - historicalARCreditBaseCcy), baseDebit: 0, baseCredit: (arCreditBaseCcy - historicalARCreditBaseCcy), description: `Realized FX Gain on Payment ${paymentNumber}`, exchangeRate: 1.0 });
      } else if (arCreditBaseCcy < historicalARCreditBaseCcy) {
        journalEntries.push({ businessId, accountId: accounts.SYSTEM_FX_GAIN_LOSS, debit: (historicalARCreditBaseCcy - arCreditBaseCcy), credit: 0, baseDebit: (historicalARCreditBaseCcy - arCreditBaseCcy), baseCredit: 0, description: `Realized FX Loss on Payment ${paymentNumber}`, exchangeRate: 1.0 });
      }
    }

    // Credit: Customer Advances (for any overpayment)
    if (overpaidAmountBaseCcy > 0) {
      journalEntries.push({ businessId, accountId: accounts.SYSTEM_CUSTOMER_ADVANCE, debit: 0, credit: overpaidAmount, baseDebit: 0, baseCredit: overpaidAmountBaseCcy, description: `Overpayment recorded as Customer Advance ${paymentNumber}`, exchangeRate: paymentRate });
    }

    // Ensure currency is set on all journal entries
    journalEntries.forEach(je => {
      je.currency = currencyData.code;
    });

    await postJournalEntries(tx, journalEntries);

    // 7. Log Audit & Trigger System Alert
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: payment.id,
      details: { paymentNumber, amount: paymentAmount, invoiceNumber: invoice.invoiceNumber, overpaidAmount }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Payment Recorded",
      message: `Payment ${paymentNumber} of amount ${paymentAmount} received for invoice ${invoice.invoiceNumber}.`,
      type: "SUCCESS",
      entityType: "Payment",
      entityId: payment.id
    });

    return { payment, creditNote };
  }, { timeout: 30000, maxWait: 30000 });
};

const createQuotationPayment = async (businessId, userId, userEmail, quotationId, data) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Quotation
    const quotation = await tx.quotation.findFirst({
      where: { id: quotationId, businessId, isDeleted: false },
      include: { payments: true }
    });

    if (!quotation) {
      throw new Error("Quotation not found");
    }

    // 2. Calculate remaining dues
    const previousPaid = quotation.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remaining = Math.max(Number(quotation.totalAmount || 0) - previousPaid, 0);

    const paymentAmount = Number(data.amount || 0);

    // 3. Generate unique payment number
    const paymentNumber = await generateDocNumber(tx, businessId, "PAY", "payment", "paymentNumber");

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    const currencyCode = data.currency || quotation.currency || "AED";
    const currencyData = await CurrencyService.resolveCurrencyData(businessId, currencyCode, paymentDate);

    // 4. Create Payment Record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        quotationId,
        businessId,
        amount: paymentAmount,
        paymentDate,
        paymentMode: data.paymentMode || "CASH",
        transactionId: data.transactionId || null,
        note: data.note || null,
        createdBy: userId,

        // Currency Fields
        currency: currencyCode,
        transactionCurrencyId: currencyData.transactionCurrencyId,
        baseCurrencyId: currencyData.baseCurrencyId,
        exchangeRate: currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.exchangeRate, currencyData.decimals),
        statutoryExchangeRate: currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.statutoryRate, currencyData.decimals)
      }
    });

    // We do not currently change quotation status on payment
    
    // 5. Log Audit & Trigger System Alert
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "QUOTATION_PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: payment.id,
      details: { paymentNumber, amount: paymentAmount, quoteNumber: quotation.quoteNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Quotation Payment Recorded",
      message: `Payment ${paymentNumber} of amount ${paymentAmount} received for quotation ${quotation.quoteNumber}.`,
      type: "SUCCESS",
      entityType: "Payment",
      entityId: payment.id
    });

    return { payment };
  });
};

const getPaymentsByInvoiceId = async (businessId, invoiceId) => {
  return await prisma.payment.findMany({
    where: { invoiceId, businessId },
    orderBy: { createdAt: "desc" }
  });
};

const getPaymentsByQuotationId = async (businessId, quotationId) => {
  return await prisma.payment.findMany({
    where: { quotationId, businessId },
    orderBy: { createdAt: "desc" }
  });
};

const getPaymentsByProjectId = async (businessId, projectId) => {
  return await prisma.payment.findMany({
    where: { projectId, businessId },
    orderBy: { createdAt: "desc" }
  });
};

const createCustomerPayment = async (businessId, userId, userEmail, customerId, data) => {
  return await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, businessId, isDeleted: false }
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const paymentAmount = Number(data.amount || 0);

    // Generate unique payment number
    const paymentNumber = await generateDocNumber(tx, businessId, "PAY", "payment", "paymentNumber");

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    const currencyCode = data.currency || "AED";
    const currencyData = await CurrencyService.resolveCurrencyData(businessId, currencyCode, paymentDate);

    // Create Payment Record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        customerId,
        businessId,
        amount: paymentAmount,
        paymentDate,
        paymentMode: data.paymentMode || "CASH",
        transactionId: data.transactionId || null,
        note: data.note || null,
        createdBy: userId,

        // Currency Fields
        currency: currencyCode,
        transactionCurrencyId: currencyData.transactionCurrencyId,
        baseCurrencyId: currencyData.baseCurrencyId,
        exchangeRate: currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.exchangeRate, currencyData.decimals),
        statutoryExchangeRate: currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.statutoryRate, currencyData.decimals)
      }
    });

    // Log Audit & Trigger System Alert
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "CUSTOMER_PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: payment.id,
      details: { paymentNumber, amount: paymentAmount, customer: customer.company }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Customer Advance Payment Recorded",
      message: `Payment ${paymentNumber} of amount ${paymentAmount} received for customer ${customer.company}.`,
      type: "SUCCESS",
      entityType: "Payment",
      entityId: payment.id
    });

    return { payment };
  });
};

const createProjectPayment = async (businessId, userId, userEmail, projectId, data) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Project
    const project = await tx.project.findFirst({
      where: { id: projectId, businessId }
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const paymentAmount = Number(data.amount || 0);

    // Generate unique payment number
    const paymentNumber = await generateDocNumber(tx, businessId, "PAY", "payment", "paymentNumber");

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    const currencyCode = data.currency || "AED";
    const currencyData = await CurrencyService.resolveCurrencyData(businessId, currencyCode, paymentDate);

    // Create Payment Record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        projectId,
        customerId: project.customerId,
        businessId,
        amount: paymentAmount,
        paymentDate,
        paymentMode: data.paymentMode || "CASH",
        transactionId: data.transactionId || null,
        note: data.note || null,
        createdBy: userId,

        // Currency Fields
        currency: currencyCode,
        transactionCurrencyId: currencyData.transactionCurrencyId,
        baseCurrencyId: currencyData.baseCurrencyId,
        exchangeRate: currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.exchangeRate, currencyData.decimals),
        statutoryExchangeRate: currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(paymentAmount, currencyData.statutoryRate, currencyData.decimals)
      }
    });

    if (data.creditNoteId) {
      const cn = await tx.creditNote.findFirst({
        where: { id: data.creditNoteId, businessId }
      });
      if (cn) {
        await tx.creditNote.update({
          where: { id: cn.id },
          data: { status: "SETTLED", remainingAmount: 0 }
        });
      }
    }

    // Log Audit & Trigger System Alert
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PROJECT_PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: payment.id,
      details: { paymentNumber, amount: paymentAmount, project: project.projectName || project.projectCode }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Project Payment Recorded",
      message: `Payment ${paymentNumber} of amount ${paymentAmount} received for project ${project.projectName || project.projectCode}.`,
      type: "SUCCESS",
      entityType: "Payment",
      entityId: payment.id
    });

    return { payment };
  }, {
    maxWait: 10000,
    timeout: 20000
  });
};

module.exports = {
  createPayment,
  createQuotationPayment,
  createCustomerPayment,
  createProjectPayment,
  getPaymentsByInvoiceId,
  getPaymentsByQuotationId,
  getPaymentsByProjectId
};
