const prisma = require("../config/prisma");
const { roundHalfUp, getCurrencyDecimals } = require("../services/currencyFxService");


//////////////////////////////////////////////////////
// GENERATE BILL NUMBER
//////////////////////////////////////////////////////
const generateBillNumber = async (businessId) => {
  const count = await prisma.bill.count({
    where: { businessId },
  });

  return `BILL-${(count + 1).toString().padStart(3, "0")}`;
};

//////////////////////////////////////////////////////
// CREATE BILL
//////////////////////////////////////////////////////
exports.createBill = async (req, res) => {
  try {
    const {
      vendorId,
      purchaseOrderId,
      items = [],
      discount = 0,
      billDate,
      dueDate,
      notes,
    } = req.body;

    const taxValue = req.body.tax !== undefined ? Number(req.body.tax) : (req.body.taxAmount !== undefined ? Number(req.body.taxAmount) : 0);
    const currency = req.body.currency || 'AED';

    if (!billDate) {
      return res.status(400).json({ success: false, message: "billDate is required" });
    }

    if (!vendorId && !purchaseOrderId) {
      return res.status(400).json({ success: false, message: "Either vendorId or purchaseOrderId is required" });
    }

    let finalItems = items.map(i => ({
      name: i.name || i.description || 'Item',
      quantity: Number(i.quantity || 0),
      price: Number(i.price !== undefined ? i.price : (i.unitPrice || 0))
    }));
    let finalVendorId = vendorId;

    if (purchaseOrderId) {
      const po = await prisma.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, businessId: req.business.id },
        include: { items: true },
      });
      if (!po) return res.status(400).json({ success: false, message: "Purchase Order not found" });
      finalVendorId = po.vendorId;
      finalItems = po.items.map((i) => ({
        name: i.name || i.description || 'Item',
        quantity: i.quantity,
        price: i.price,
      }));
    }

    const vendor = await prisma.vendor.findFirst({
      where: { id: finalVendorId, businessId: req.business.id },
    });
    if (!vendor) return res.status(400).json({ success: false, message: "Vendor not found" });

    const subtotal = req.body.subtotal !== undefined ? Number(req.body.subtotal) : finalItems.reduce((sum, i) => sum + i.quantity * i.price, 0);
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount) : (subtotal + taxValue - discount);

    const business = await prisma.business.findUnique({
      where: { id: req.business.id },
      include: { baseCurrency: true }
    });

    let transactionCurrencyId = null;
    let baseCurrencyId = business?.baseCurrencyId || null;
    let exchangeRate = req.body.exchangeRate !== undefined ? Number(req.body.exchangeRate) : null;
    let baseCurrencyAmount = null;

    if (currency) {
      const ccy = await prisma.currency.upsert({
        where: { code: currency },
        update: {},
        create: {
          code: currency,
          name: currency,
          symbol: currency,
          decimals: 2,
          decimalPrecision: 2
        }
      });
      transactionCurrencyId = ccy.id;
    }

    if (!baseCurrencyId && (business?.currency || business?.baseCurrency?.code)) {
      const bCode = business?.currency || business?.baseCurrency?.code;
      const baseCcy = await prisma.currency.findUnique({ where: { code: bCode } });
      if (baseCcy) baseCurrencyId = baseCcy.id;
    }

    if (transactionCurrencyId && baseCurrencyId) {
      if (transactionCurrencyId === baseCurrencyId) {
        exchangeRate = 1.0;
      } else if (!exchangeRate) {
        const rateRec = await prisma.exchangeRate.findFirst({
          where: {
            fromCurrencyId: transactionCurrencyId,
            toCurrencyId: baseCurrencyId,
            effectiveDate: { lte: new Date(billDate) },
          },
          orderBy: { effectiveDate: 'desc' }
        });
        exchangeRate = rateRec ? rateRec.rate : 1.0;
      }
    } else {
      exchangeRate = exchangeRate || 1.0;
    }

    const billDecimals = getCurrencyDecimals(currency);
    totalAmount = roundHalfUp(subtotal + taxValue - discount, billDecimals);
    baseCurrencyAmount = roundHalfUp(totalAmount * exchangeRate, billDecimals);

    const bill = await prisma.bill.create({
      data: {
        businessId: req.business.id,
        billNumber: await generateBillNumber(req.business.id),
        vendorId: finalVendorId,
        purchaseOrderId,
        subtotal,
        tax: taxValue,
        discount,
        totalAmount,
        outstandingAmount: totalAmount,
        currency,
        transactionCurrencyId,
        baseCurrencyId,
        exchangeRate,
        baseCurrencyAmount,
        statutoryExchangeRate: exchangeRate,
        statutoryBaseAmount: baseCurrencyAmount,
        billDate: new Date(billDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        items: {
          create: finalItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            total: i.quantity * i.price,
          })),
        },
      },
      include: { vendor: true, items: true, purchaseOrder: true },
    });

    if (taxValue > 0) {
      const isIndia = business?.country === 'INDIA' || business?.countryCode === 'IN';
      await prisma.taxTransaction.create({
        data: {
          businessId: req.business.id,
          transactionType: 'BILL',
          transactionId: bill.id,
          documentNumber: bill.billNumber,
          taxType: isIndia ? 'GST' : 'VAT',
          taxRate: 5,
          taxableAmount: subtotal,
          taxAmount: taxValue,
          transactionCurrencyId,
          exchangeRate,
          taxableAmountBaseCcy: Number((subtotal * exchangeRate).toFixed(2)),
          taxAmountBaseCcy: Number((taxValue * exchangeRate).toFixed(2)),
          transactionDate: new Date(billDate),
        }
      }).catch(err => console.error("TaxTransaction creation failed:", err.message));
    }

    res.status(201).json({ success: true, bill });
  } catch (error) {
    console.error("createBill error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
//////////////////////////////////////////////////////
// GET SINGLE BILL
//////////////////////////////////////////////////////
exports.getBills = async (req, res) => {
  try {
    const bills = await prisma.bill.findMany({
      where: { businessId: req.business.id },
      include: { vendor: true, items: true, purchaseOrder: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBillById = async (req, res) => {
  const bill = await prisma.bill.findFirst({
    where: {
      id: req.params.id,
      businessId: req.business.id,
    },
    include: {
      vendor: true,
      items: true,
      purchaseOrder: true,
    },
  });

  if (!bill) {
    return res.status(404).json({
      success: false,
      message: "Bill not found",
    });
  }

  res.json({ success: true, bill });
};

//////////////////////////////////////////////////////
// UPDATE BILL
//////////////////////////////////////////////////////
exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      items = [],
      tax = 0,
      discount = 0,
      billDate,
      dueDate,
      notes,
    } = req.body;

    const bill = await prisma.bill.findFirst({
      where: { id, businessId: req.business.id },
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    //////////////////////////////////////////////////////
    // RECALCULATE
    //////////////////////////////////////////////////////
    let calculatedSubtotal = 0;
    let calculatedLineTax = 0;

    for (const item of items) {
      const qty = Number(item.quantity || 0);
      const prc = Number(item.price || 0);
      const lineAmt = qty * prc;
      calculatedSubtotal += lineAmt;

      if (item.tax !== undefined) {
        calculatedLineTax += Number(item.tax || 0);
      } else if (item.taxPercent !== undefined) {
        calculatedLineTax += (lineAmt * (Number(item.taxPercent) / 100));
      } else if (item.total !== undefined && item.total > lineAmt) {
        calculatedLineTax += (item.total - lineAmt);
      }
    }

    let currency = req.body.currency || bill.currency;
    let exchangeRate = req.body.exchangeRate !== undefined ? Number(req.body.exchangeRate) : bill.exchangeRate;
    let transactionCurrencyId = bill.transactionCurrencyId;
    let baseCurrencyId = bill.baseCurrencyId;

    if (req.body.currency && req.body.currency !== bill.currency) {
      const ccy = await prisma.currency.upsert({
        where: { code: req.body.currency },
        update: {},
        create: {
          code: req.body.currency,
          name: req.body.currency,
          symbol: req.body.currency,
          decimals: 2,
          decimalPrecision: 2
        }
      });
      transactionCurrencyId = ccy.id;
      if (transactionCurrencyId === baseCurrencyId) {
        exchangeRate = 1.0;
      }
    }

    const finalRate = exchangeRate || 1.0;
    const updateDecimals = getCurrencyDecimals(currency || bill.currency);
    const business = await prisma.business.findUnique({
      where: { id: req.business.id },
      include: { baseCurrency: true }
    });
    const baseCurrencyCode = business?.baseCurrency?.code || business?.currency || 'INR';
    const baseDecimals = business?.baseCurrency?.decimals !== undefined 
      ? business.baseCurrency.decimals 
      : getCurrencyDecimals(baseCurrencyCode);

    const subtotal = roundHalfUp(calculatedSubtotal, updateDecimals);
    const finalTax = calculatedLineTax > 0
      ? roundHalfUp(calculatedLineTax, updateDecimals)
      : roundHalfUp(Number(tax !== undefined ? tax : (bill.tax || 0)), updateDecimals);
    const finalDiscount = roundHalfUp(Number(discount !== undefined ? discount : (bill.discount || 0)), updateDecimals);

    const totalAmount = roundHalfUp(subtotal + finalTax - finalDiscount, updateDecimals);
    const baseCurrencyAmount = roundHalfUp(totalAmount * finalRate, baseDecimals);

    //////////////////////////////////////////////////////
    // DELETE OLD ITEMS
    //////////////////////////////////////////////////////
    await prisma.billItem.deleteMany({
      where: { billId: id },
    });

    //////////////////////////////////////////////////////
    // UPDATE
    //////////////////////////////////////////////////////
    const updated = await prisma.bill.update({
      where: { id },
      data: {
        subtotal,
        tax,
        discount,
        totalAmount,
        currency,
        transactionCurrencyId,
        exchangeRate: finalRate,
        baseCurrencyAmount,
        statutoryExchangeRate: finalRate,
        statutoryBaseAmount: baseCurrencyAmount,
        billDate: billDate ? new Date(billDate) : bill.billDate,
        dueDate: dueDate ? new Date(dueDate) : bill.dueDate,
        notes,

        items: {
          create: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            total: i.quantity * i.price,
          })),
        },
      },
      include: {
        items: true,
        vendor: true,
      },
    });

    res.json({ success: true, bill: updated });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

//////////////////////////////////////////////////////
// DELETE BILL
//////////////////////////////////////////////////////
exports.deleteBill = async (req, res) => {
  const { id } = req.params;

  const bill = await prisma.bill.findFirst({
    where: { id, businessId: req.business.id },
  });

  if (!bill) {
    return res.status(404).json({
      success: false,
      message: "Bill not found",
    });
  }

  await prisma.bill.delete({
    where: { id },
  });

  res.json({ success: true, message: "Bill deleted" });
};