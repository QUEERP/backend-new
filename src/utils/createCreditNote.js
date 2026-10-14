const prisma = require("../config/prisma");
const cloudinary = require("../config/cloudinary");
const generatePdf = require("./generatePdf");
const creditTemplate = require("../templates/creditNoteTemplate");
const { roundHalfUp, getCurrencyDecimals } = require("../services/currencyFxService");

module.exports = async ({
  invoice = null,
  bill = null,
  businessId,
  extraAmount,
  type = "INVOICE", // 🔥 NEW
}) => {
  try {

    //////////////////////////////////////////////////////
    // CREDIT NUMBER (SEPARATE FOR BILL / INVOICE)
    //////////////////////////////////////////////////////
    const prefix = type === "BILL" ? "BCN" : "CN";

    const last = await prisma.creditNote.findFirst({
      where: { businessId, type },
      orderBy: { createdAt: "desc" },
      select: { creditNumber: true },
    });

    let next = 1;

    if (last?.creditNumber) {
      const lastNum = parseInt(last.creditNumber.split("-")[1]);
      next = lastNum + 1;
    }

    const creditNumber = `${prefix}-${String(next).padStart(3, "0")}`;

    const currency = invoice?.currency || bill?.currency || "AED";
    const decimals = getCurrencyDecimals(currency);
    const exchangeRate = Number(invoice?.exchangeRate || bill?.exchangeRate || 1);
    const amount = roundHalfUp(Number(extraAmount), decimals);
    const baseCurrencyAmount = roundHalfUp(amount * exchangeRate, decimals);

    //////////////////////////////////////////////////////
    // CREATE CREDIT NOTE
    //////////////////////////////////////////////////////
    const credit = await prisma.creditNote.create({
      data: {
        businessId,
        customerId: invoice?.customerId || null,
        vendorId: bill?.vendorId || null,
        invoiceId: invoice?.id || null,
        creditNumber,
        type,
        amount,
        remainingAmount: amount,
        reason:
          type === "BILL"
            ? "Bill Overpayment"
            : "Invoice Overpayment",
        status: "OPEN",
        currency,
        exchangeRate,
        baseCurrencyAmount,
        statutoryExchangeRate: exchangeRate,
        statutoryBaseAmount: baseCurrencyAmount,
        transactionCurrencyId: invoice?.transactionCurrencyId || bill?.transactionCurrencyId || null,
        baseCurrencyId: invoice?.baseCurrencyId || bill?.baseCurrencyId || null,
      },
    });

    //////////////////////////////////////////////////////
    // FETCH COMPLETE DATA
    //////////////////////////////////////////////////////
    const creditData = await prisma.creditNote.findUnique({
      where: { id: credit.id },
      include: {
        customer: true,
        vendor: true, // 🔥 IMPORTANT
        invoice: {
          include: {
            items: true,
          },
        },
      },
    });

    //////////////////////////////////////////////////////
    // GENERATE PDF
    //////////////////////////////////////////////////////
    const html = creditTemplate(creditData);

    const pdfBuffer = await generatePdf(html);

    //////////////////////////////////////////////////////
    // UPLOAD TO CLOUDINARY
    //////////////////////////////////////////////////////
    const pdfWorkflow = require("./pdfWorkflow");
    const secureUrl = await pdfWorkflow(pdfBuffer, creditNumber, "credit-note-pdfs");

    //////////////////////////////////////////////////////
    // SAVE URL
    //////////////////////////////////////////////////////
    const updated = await prisma.creditNote.update({
      where: { id: credit.id },
      data: {
        pdfUrl: secureUrl,
      },
      include: {
        customer: true,
        vendor: true,
        invoice: true,
      },
    });

    return updated;

  } catch (error) {
    console.error("Credit Note Creation Error:", error);
    throw new Error("Failed to create credit note");
  }
};