const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("../sales/audit.service");
const { generateDocNumber } = require("../sales/quotation.service");
const { CurrencyService } = require("../currencyService");
const { getSystemAccounts, getDynamicExpenseAccount, postJournalEntries } = require("../ledgerService");

const recordVendorPayment = async (businessId, userId, userEmail, billId, data) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Bill
    const bill = await tx.bill.findFirst({
      where: { id: billId, businessId },
      include: { vendor: true }
    });

    if (!bill) {
      throw new Error("Bill not found");
    }

    if (bill.status === "PAID") {
      throw new Error("Bill is already fully paid.");
    }

    const paymentAmount = parseFloat(data.amount);
    if (paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than 0.");
    }

    if (paymentAmount > bill.outstandingAmount) {
      throw new Error(`Payment amount exceeds the outstanding bill amount of ${bill.outstandingAmount}.`);
    }

    // 2. Generate Payment Number
    const paymentNumber = await generateDocNumber(tx, businessId, "VPAY", "payment", "paymentNumber");

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

    // Re-resolve current payment exchange rate
    const paymentCurrencyCode = data.currency || bill.currency || "AED";
    const paymentCurrencyData = await CurrencyService.resolveCurrencyData(businessId, paymentCurrencyCode, paymentDate);
    const paymentRate = paymentCurrencyData.exchangeRate;
    const decimals = paymentCurrencyData.decimals;

    // 3. Create Payment Record linked to Bill
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        billId,
        businessId,
        amount: paymentAmount,
        paymentDate,
        paymentMode: data.paymentMode || "BANK_TRANSFER",
        transactionId: data.transactionId || null,
        note: data.note || null,
        createdBy: userId
      }
    });

    // POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    
    const billRate = bill.exchangeRate || 1.0;
    
    // Scale precisely
    // Credit Cash at payment rate (Outbound cash)
    const cashCreditBase = CurrencyService.scaleAmount(paymentAmount, paymentRate, decimals);
    
    // Debit AP at the original bill rate to clear it proportionally
    const apDebitBase = CurrencyService.scaleAmount(paymentAmount, billRate, decimals);

    // Difference goes to FX Gain/Loss. Plug technique forces exact balance.
    // Base Debit (AP) - Base Credit (Cash) = Difference
    const fxDifference = Number((apDebitBase - cashCreditBase).toFixed(decimals));
    
    const journalEntries = [
      // Credit: Cash (Outbound at current rate)
      { businessId, accountId: accounts.SYSTEM_CASH, debit: 0, credit: paymentAmount, baseDebit: 0, baseCredit: cashCreditBase, description: `Vendor Payment ${paymentNumber} for Bill ${bill.billNumber}`, exchangeRate: paymentRate },
      
      // Debit: Accounts Payable (Clearing liability at original rate)
      { businessId, accountId: accounts.SYSTEM_AP, debit: paymentAmount, credit: 0, baseDebit: apDebitBase, baseCredit: 0, description: `Payment Applied ${paymentNumber} for Bill ${bill.billNumber}`, exchangeRate: billRate }
    ];

    if (fxDifference !== 0) {
      // If fxDifference > 0: apDebitBase > cashCreditBase -> We cleared more AP liability than the cash we paid out -> GAIN (Credit)
      // If fxDifference < 0: cashCreditBase > apDebitBase -> We paid more cash than the AP liability we cleared -> LOSS (Debit)
      const fxGainLossAccountId = await getDynamicExpenseAccount(tx, businessId, "Realized FX Gain/Loss");
      if (fxDifference > 0) {
        journalEntries.push({ businessId, accountId: fxGainLossAccountId, debit: 0, credit: 0, baseDebit: 0, baseCredit: Math.abs(fxDifference), description: `Realized FX Gain on Payment ${paymentNumber}`, exchangeRate: 1.0 }); // Rate 1.0 for base-only legs
      } else {
        journalEntries.push({ businessId, accountId: fxGainLossAccountId, debit: 0, credit: 0, baseDebit: Math.abs(fxDifference), baseCredit: 0, description: `Realized FX Loss on Payment ${paymentNumber}`, exchangeRate: 1.0 });
      }
    }

    await postJournalEntries(tx, journalEntries);

    // 4. Update Bill outstanding amount and status
    const newOutstanding = Math.max(bill.outstandingAmount - paymentAmount, 0);
    let newStatus = "UNPAID";
    if (newOutstanding === 0) {
      newStatus = "PAID";
    } else if (newOutstanding < bill.totalAmount) {
      newStatus = "PARTIALLY_PAID";
    }

    await tx.bill.update({
      where: { id: billId },
      data: {
        outstandingAmount: newOutstanding,
        status: newStatus
      }
    });

    // 5. Decrement Vendor Liability Balance
    await tx.vendor.update({
      where: { id: bill.vendorId },
      data: {
        balance: {
          decrement: paymentAmount
        }
      }
    });

    // 6. Log Audit and Alerts
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "VENDOR_PAYMENT_RECORDED",
      module: "PURCHASE",
      entityType: "Payment",
      entityId: payment.id,
      details: { paymentNumber, amount: paymentAmount, billNumber: bill.billNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Vendor Payment Recorded",
      message: `Paid ${paymentAmount} to vendor ${bill.vendor.name} for bill ${bill.billNumber}.`,
      type: "SUCCESS",
      entityType: "Payment",
      entityId: payment.id
    });

    return payment;
  }, { maxWait: 5000, timeout: 30000 });
};

const getPaymentsByBillId = async (businessId, billId) => {
  return await prisma.payment.findMany({
    where: { billId, businessId },
    orderBy: { createdAt: "desc" }
  });
};

module.exports = {
  recordVendorPayment,
  getPaymentsByBillId
};
