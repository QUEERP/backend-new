const prisma = require("../config/prisma");

// NOTE: P&L and Balance Sheet still use synthetic aggregation from Invoices/Expenses/Payments,
// not JournalEntry. They may diverge from Trial Balance for periods with manual journal entries.

//////////////////////////////////////////////////////
// TAX REPORTS
//////////////////////////////////////////////////////
const gstTaxReportService = require("../services/gstTaxReportService");
const {
  roundHalfUp,
  getCurrencyDecimals,
  toMinorUnits,
  fromMinorUnits,
  convertToMinorBase,
  calculateRealizedFx,
  calculateUnrealizedFx
} = require("../services/currencyFxService");

exports.getTaxSummary = async (req, res) => {
  try {
    const businessId = req.business.id; // STRICT SCOPING
    const { fromDate, toDate } = req.query;

    const result = await gstTaxReportService.generateGstTaxSummary({
      businessId,
      fromDate,
      toDate
    });

    res.json(result);
  } catch (error) {
    console.error("getTaxSummary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTaxTransactions = async (req, res) => {
  try {
    const businessId = req.business.id; // STRICT SCOPING
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const { fromDate, toDate, transactionType } = req.query;

    const where = { businessId };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }
    if (transactionType) where.transactionType = transactionType;

    const totalCount = await prisma.taxTransaction.count({ where });
    
    let rawTransactions = await prisma.taxTransaction.findMany({
      where,
      include: {
        transactionCurrency: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const allTaxRates = await prisma.taxRate.findMany({ include: { taxType: true } }).catch(() => []);
    const taxRateMap = {};
    allTaxRates.forEach(tr => { taxRateMap[tr.id] = tr; });

    let transactions = rawTransactions.map(t => ({
      ...t,
      taxRate: t.taxRateId ? taxRateMap[t.taxRateId] : null
    }));

    // If no records in taxTransaction, synthesize from Invoices & Bills
    if (totalCount === 0) {
      const invs = await prisma.invoice.findMany({
        where: { businessId, status: { not: 'DRAFT' }, totalTax: { gt: 0 } },
        include: { transactionCurrency: true },
        take: limit
      });
      const bills = await prisma.bill.findMany({
        where: { businessId, tax: { gt: 0 } },
        include: { transactionCurrency: true },
        take: limit
      });

      const synthetic = [];
      invs.forEach(inv => {
        synthetic.push({
          id: `syn-inv-${inv.id}`,
          transactionType: 'INVOICE',
          transactionId: inv.id,
          taxAmountTxnCcy: inv.totalTax,
          taxAmountBaseCcy: inv.baseCurrencyAmount ? (inv.totalTax * (inv.exchangeRate || 1)) : inv.totalTax,
          taxableAmountBaseCcy: inv.subtotal || 0,
          transactionCurrency: { code: inv.currency || 'INR' },
          createdAt: inv.invoiceDate || inv.createdAt,
          itemReference: inv.invoiceNumber
        });
      });
      bills.forEach(bill => {
        synthetic.push({
          id: `syn-bill-${bill.id}`,
          transactionType: 'BILL',
          transactionId: bill.id,
          taxAmountTxnCcy: bill.tax,
          taxAmountBaseCcy: bill.tax * (bill.exchangeRate || 1),
          taxableAmountBaseCcy: bill.subtotal || 0,
          transactionCurrency: { code: bill.currency || 'INR' },
          createdAt: bill.billDate || bill.createdAt,
          itemReference: bill.billNumber
        });
      });

      return res.json({
        success: true,
        transactions: synthetic,
        pagination: {
          total: synthetic.length,
          page: 1,
          limit,
          totalPages: 1
        }
      });
    }

    res.json({
      success: true,
      transactions,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// CURRENCY REPORTS
//////////////////////////////////////////////////////
exports.getCurrencyUsage = async (req, res) => {
  try {
    const businessId = req.business.id; // STRICT SCOPING
    const { fromDate, toDate, currencyId } = req.query;
    
    // Fetch business base currency
    const business = await prisma.business.findUnique({ 
      where: { id: businessId },
      include: { baseCurrency: true }
    });

    const baseCode = business?.baseCurrency?.code || business?.currencyCode || business?.currency || 'INR';
    const baseSymbol = business?.baseCurrency?.symbol || business?.currencySymbol || (baseCode === 'INR' ? '₹' : baseCode === 'AED' ? 'AED' : '$');
    const baseName = business?.baseCurrency?.name || (baseCode === 'INR' ? 'Indian Rupee' : baseCode === 'AED' ? 'UAE Dirham' : baseCode);
    const baseCcyId = business?.baseCurrencyId;

    // Load all currencies
    const allCurrencies = await prisma.currency.findMany();
    const ccyByCode = {};
    const ccyById = {};
    allCurrencies.forEach(c => {
      ccyByCode[c.code] = c;
      ccyById[c.id] = c;
    });

    // Load commercial exchange rates
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { effectiveDate: 'desc' }
    });

    // Date filtering using IST day boundaries aligned with Tax Reports
    const { gte, lte } = gstTaxReportService.parseIstDateBoundaries ? gstTaxReportService.parseIstDateBoundaries(fromDate, toDate) : { gte: undefined, lte: undefined };
    const dateFilter = {};
    if (gte) dateFilter.gte = gte;
    if (lte) dateFilter.lte = lte;
    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const periodEndDate = lte ? new Date(lte) : (toDate ? new Date(toDate) : new Date());

    const getRateDetails = (fromCode, toCode) => {
      if (fromCode === toCode) {
        return {
          rate: 1.0,
          effectiveDate: null,
          source: 'Base Currency (1:1 Invariant)',
          rateType: 'BASE',
          isStale: false,
          staleWarning: null
        };
      }
      const fromId = ccyByCode[fromCode]?.id;
      const toId = ccyByCode[toCode]?.id;
      if (fromId && toId) {
        // Direct rate as of period-end date
        const directRates = rates.filter(r => r.fromCurrencyId === fromId && r.toCurrencyId === toId);
        let matched = directRates.find(r => new Date(r.effectiveDate) <= periodEndDate);
        let isInverse = false;

        if (!matched && directRates.length > 0) {
          // If no rate on or before period-end, take closest available direct rate
          matched = directRates[0];
        }

        if (!matched) {
          const invRates = rates.filter(r => r.fromCurrencyId === toId && r.toCurrencyId === fromId);
          matched = invRates.find(r => new Date(r.effectiveDate) <= periodEndDate) || invRates[0];
          if (matched) isInverse = true;
        }

        if (matched) {
          const rawRate = Number(matched.rate);
          const rate = isInverse ? (1 / rawRate) : rawRate;
          const effDate = new Date(matched.effectiveDate);
          const diffMs = Math.abs(periodEndDate.getTime() - effDate.getTime());
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const isStale = diffDays > 30;
          const staleWarning = isStale
            ? `Exchange rate effective date (${effDate.toISOString().slice(0, 10)}) is ${diffDays} days older than report period-end (${periodEndDate.toISOString().slice(0, 10)}). Statutory threshold is 30 days.`
            : null;

          const baseSource = matched.source || (matched.rateType ? `${matched.rateType} Rate Table` : 'Exchange Rate Table');
          const source = isInverse ? `Inverse of ${baseSource}` : baseSource;

          return {
            rate,
            effectiveDate: matched.effectiveDate,
            fetchedAt: matched.fetchedAt || matched.createdAt || matched.effectiveDate,
            source,
            rateType: matched.rateType || 'COMMERCIAL',
            isStale,
            diffDays,
            staleWarning
          };
        }
      }

      return {
        rate: 1.0,
        effectiveDate: null,
        source: 'Default 1.0 (No rate recorded in table)',
        rateType: 'UNRECORDED',
        isStale: true,
        diffDays: 999,
        staleWarning: `No exchange rate record found between ${fromCode} and ${toCode} in exchange rate table.`
      };
    };

    const dataQualityWarnings = [];

    // 1. Invoices (Tax Reports posted statuses)
    const invWhere = {
      businessId,
      isDeleted: false,
      status: { in: gstTaxReportService.POSTED_INVOICE_STATUSES || ['PAID', 'UNPAID', 'PARTIALLY_PAID', 'PARTIAL_PAID', 'SENT', 'APPROVED', 'OVERDUE'] }
    };
    if (hasDateFilter) invWhere.invoiceDate = dateFilter;
    const invoices = await prisma.invoice.findMany({
      where: invWhere,
      include: { payments: true }
    });

    // 2. Bills (Tax Reports posted statuses)
    const billWhere = {
      businessId,
      status: { in: gstTaxReportService.POSTED_BILL_STATUSES || ['PAID', 'UNPAID', 'PARTIALLY_PAID'] }
    };
    if (hasDateFilter) billWhere.billDate = dateFilter;
    const bills = await prisma.bill.findMany({
      where: billWhere,
      include: { payments: true, vendor: true }
    });

    // 3. Credit Notes (Tax Reports posted statuses)
    const cnWhere = {
      businessId,
      isDeleted: false,
      status: { in: ['OPEN', 'CLOSED'] }
    };
    if (hasDateFilter) cnWhere.createdAt = dateFilter;
    const creditNotes = await prisma.creditNote.findMany({ where: cnWhere });

    // 4. Purchase Returns (Tax Reports posted statuses)
    const prtWhere = {
      businessId,
      status: { notIn: ['DRAFT', 'CANCELLED'] }
    };
    if (hasDateFilter) prtWhere.createdAt = dateFilter;
    let purchaseReturns = [];
    try {
      purchaseReturns = await prisma.purchaseReturn.findMany({ where: prtWhere });
    } catch (e) {
      purchaseReturns = [];
    }

    // 5. Standalone Payments
    const payWhere = {
      businessId,
      invoiceId: null,
      billId: null
    };
    if (hasDateFilter) payWhere.paymentDate = dateFilter;
    const standalonePayments = await prisma.payment.findMany({ where: payWhere });

    // 6. Quotations
    const qWhere = { businessId };
    if (hasDateFilter) qWhere.issueDate = dateFilter;
    const quotations = await prisma.quotation.findMany({ where: qWhere });

    // 7. Sales Orders
    const soWhere = { businessId };
    if (hasDateFilter) soWhere.orderDate = dateFilter;
    const salesOrders = await prisma.salesOrder.findMany({ where: soWhere });

    // 8. Purchase Orders
    const poWhere = { businessId };
    if (hasDateFilter) poWhere.orderDate = dateFilter;
    const purchaseOrders = await prisma.purchaseOrder.findMany({ where: poWhere });

    // Group by currency with integer minor units
    const grouped = {};

    const getBucket = (code, ccyId) => {
      const c = code || baseCode;
      if (!grouped[c]) {
        const rateDetails = getRateDetails(c, baseCode);
        grouped[c] = {
          currency: c,
          currencyId: ccyId || ccyByCode[c]?.id || 'curr-' + c,
          exchangeRate: rateDetails.rate,
          rateDetails,
          breakdown: [],
          summaryMinor: {
            sales: 0,
            salesBase: 0,
            purchases: 0,
            purchasesBase: 0,
            receivables: 0,
            receivablesBase: 0,
            payables: 0,
            payablesBase: 0
          },
          realizedMinorGain: 0,
          realizedMinorLoss: 0,
          unrealizedMinorGain: 0,
          unrealizedMinorLoss: 0,
          openReceivablesMinor: 0,
          openPayablesMinor: 0
        };
      }
      return grouped[c];
    };

    // Process Invoices
    invoices.forEach(inv => {
      const code = inv.currency || (inv.transactionCurrencyId ? ccyById[inv.transactionCurrencyId]?.code : baseCode);
      const b = getBucket(code, inv.transactionCurrencyId);
      const decimals = getCurrencyDecimals(code);
      const nominal = Number(inv.grandTotal ?? (inv.subtotal + (inv.totalTax || 0) + (inv.shippingCharges || 0) - (inv.discount || 0)) ?? 0);
      const nominalMinor = toMinorUnits(nominal, decimals);
      const bookingRate = Number(inv.exchangeRate || (code === baseCode ? 1 : b.exchangeRate) || 1);
      const expectedBase = roundHalfUp(nominal * bookingRate, decimals);
      const actualBase = Number(inv.baseCurrencyAmount !== null && inv.baseCurrencyAmount !== undefined ? inv.baseCurrencyAmount : expectedBase);

      if (Math.abs(actualBase - expectedBase) > 0.01) {
        dataQualityWarnings.push({
          code: 'BASE_CURRENCY_AMOUNT_MISMATCH',
          documentType: 'Invoice',
          documentNumber: inv.invoiceNumber,
          nominal,
          rate: bookingRate,
          actualBase,
          expectedBase,
          diff: roundHalfUp(actualBase - expectedBase, decimals),
          message: `Invoice ${inv.invoiceNumber}: stored baseCurrencyAmount (${actualBase}) diverges from grandTotal x exchangeRate (${nominal} x ${bookingRate} = ${expectedBase})`
        });
      }

      // Do NOT mask or override with nominal: use the stored baseCurrencyAmount
      const baseMinor = toMinorUnits(actualBase, decimals);

      b.breakdown.push({
        transactionType: 'Invoice',
        docNumber: inv.invoiceNumber,
        nominal: fromMinorUnits(nominalMinor, decimals),
        volumeBaseCcy: fromMinorUnits(baseMinor, decimals),
        rate: bookingRate,
        tax: inv.totalTax || 0,
        status: inv.status
      });
      b.summaryMinor.sales += nominalMinor;
      b.summaryMinor.salesBase += baseMinor;

      // Realized FX on invoice payments
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach(pay => {
          const settledAmt = Number(pay.amount || 0);
          const settledMinor = toMinorUnits(settledAmt, decimals);
          const payRate = Number(pay.exchangeRate || bookingRate);
          const payBaseMinor = (code === baseCode) ? settledMinor : convertToMinorBase(settledMinor, payRate);

          b.summaryMinor.receivables += settledMinor;
          b.summaryMinor.receivablesBase += payBaseMinor;

          if (code !== baseCode) {
            const fx = calculateRealizedFx({
              type: 'RECEIVABLE',
              bookingRate,
              settlementRate: payRate,
              foreignAmountSettled: settledAmt,
              decimals
            });
            b.realizedMinorGain += toMinorUnits(fx.realizedGain, decimals);
            b.realizedMinorLoss += toMinorUnits(fx.realizedLoss, decimals);
          }
        });
      }

      // Unrealized FX on open balance revalued at latest rate
      if (code !== baseCode) {
        const paid = Number(inv.amountPaid || 0);
        const openBal = Math.max(0, nominal - paid);
        if (openBal > 0) {
          const openMinor = toMinorUnits(openBal, decimals);
          b.openReceivablesMinor += openMinor;
          const latestRate = Number(b.exchangeRate);
          const uFx = calculateUnrealizedFx({
            type: 'RECEIVABLE',
            bookingRate,
            latestRate,
            openForeignAmount: openBal,
            decimals
          });
          b.unrealizedMinorGain += toMinorUnits(uFx.unrealizedGain, decimals);
          b.unrealizedMinorLoss += toMinorUnits(uFx.unrealizedLoss, decimals);
        }
      }
    });

    // Process Bills
    bills.forEach(bill => {
      const code = bill.currency || (bill.transactionCurrencyId ? ccyById[bill.transactionCurrencyId]?.code : baseCode);
      const b = getBucket(code, bill.transactionCurrencyId);
      const decimals = getCurrencyDecimals(code);
      const nominal = Number(bill.totalAmount ?? (bill.subtotal + (bill.tax || 0) - (bill.discount || 0)) ?? 0);
      const nominalMinor = toMinorUnits(nominal, decimals);
      const bookingRate = Number(bill.exchangeRate || (code === baseCode ? 1 : b.exchangeRate) || 1);
      const expectedBase = roundHalfUp(nominal * bookingRate, decimals);
      const actualBase = Number(bill.baseCurrencyAmount !== null && bill.baseCurrencyAmount !== undefined ? bill.baseCurrencyAmount : expectedBase);

      if (Math.abs(actualBase - expectedBase) > 0.01) {
        dataQualityWarnings.push({
          code: 'BASE_CURRENCY_AMOUNT_MISMATCH',
          documentType: 'Bill',
          documentNumber: bill.billNumber,
          nominal,
          rate: bookingRate,
          actualBase,
          expectedBase,
          diff: roundHalfUp(actualBase - expectedBase, decimals),
          message: `Bill ${bill.billNumber}: stored baseCurrencyAmount (${actualBase}) diverges from totalAmount x exchangeRate (${nominal} x ${bookingRate} = ${expectedBase})`
        });
      }

      // Do NOT mask or override with nominal: use the stored baseCurrencyAmount
      const baseMinor = toMinorUnits(actualBase, decimals);

      b.breakdown.push({
        transactionType: 'Bill',
        docNumber: bill.billNumber,
        nominal: fromMinorUnits(nominalMinor, decimals),
        volumeBaseCcy: fromMinorUnits(baseMinor, decimals),
        rate: bookingRate,
        tax: bill.tax || 0,
        status: bill.status
      });
      b.summaryMinor.purchases += nominalMinor;
      b.summaryMinor.purchasesBase += baseMinor;

      // Realized FX on bill payments (Payable - opposite sign)
      if (bill.payments && bill.payments.length > 0) {
        bill.payments.forEach(pay => {
          const settledAmt = Number(pay.amount || 0);
          const settledMinor = toMinorUnits(settledAmt, decimals);
          const payRate = Number(pay.exchangeRate || bookingRate);
          const payBaseMinor = (code === baseCode) ? settledMinor : convertToMinorBase(settledMinor, payRate);

          b.summaryMinor.payables += settledMinor;
          b.summaryMinor.payablesBase += payBaseMinor;

          if (code !== baseCode) {
            const fx = calculateRealizedFx({
              type: 'PAYABLE',
              bookingRate,
              settlementRate: payRate,
              foreignAmountSettled: settledAmt,
              decimals
            });
            b.realizedMinorGain += toMinorUnits(fx.realizedGain, decimals);
            b.realizedMinorLoss += toMinorUnits(fx.realizedLoss, decimals);
          }
        });
      }

      // Unrealized FX on open balance
      if (code !== baseCode) {
        const paid = Number(bill.amountPaid || 0);
        const openBal = Math.max(0, nominal - paid);
        if (openBal > 0) {
          const openMinor = toMinorUnits(openBal, decimals);
          b.openPayablesMinor += openMinor;
          const latestRate = Number(b.exchangeRate);
          const uFx = calculateUnrealizedFx({
            type: 'PAYABLE',
            bookingRate,
            latestRate,
            openForeignAmount: openBal,
            decimals
          });
          b.unrealizedMinorGain += toMinorUnits(uFx.unrealizedGain, decimals);
          b.unrealizedMinorLoss += toMinorUnits(uFx.unrealizedLoss, decimals);
        }
      }
    });

    // Process Credit Notes
    creditNotes.forEach(cn => {
      const code = cn.currency || baseCode;
      const b = getBucket(code, cn.transactionCurrencyId);
      const decimals = getCurrencyDecimals(code);
      const nominal = Number(cn.amount || cn.grandTotal || cn.subtotal || 0);
      const nominalMinor = toMinorUnits(nominal, decimals);
      const rate = Number(cn.exchangeRate || (code === baseCode ? 1 : b.exchangeRate) || 1);
      const expectedBase = roundHalfUp(nominal * rate, decimals);
      const actualBase = Number(cn.baseCurrencyAmount !== null && cn.baseCurrencyAmount !== undefined ? cn.baseCurrencyAmount : expectedBase);

      if (Math.abs(actualBase - expectedBase) > 0.01) {
        dataQualityWarnings.push({
          code: 'BASE_CURRENCY_AMOUNT_MISMATCH',
          documentType: 'CreditNote',
          documentNumber: cn.creditNumber || cn.creditNoteNumber,
          nominal,
          rate,
          actualBase,
          expectedBase,
          diff: roundHalfUp(actualBase - expectedBase, decimals),
          message: `Credit Note ${cn.creditNumber || cn.creditNoteNumber}: stored baseCurrencyAmount (${actualBase}) diverges from amount x exchangeRate (${nominal} x ${rate} = ${expectedBase})`
        });
      }

      const baseMinor = toMinorUnits(actualBase, decimals);

      b.breakdown.push({
        transactionType: 'CreditNote',
        docNumber: cn.creditNumber || cn.creditNoteNumber,
        nominal: fromMinorUnits(nominalMinor, decimals),
        volumeBaseCcy: fromMinorUnits(baseMinor, decimals),
        rate,
        tax: cn.taxAmount || cn.tax || 0,
        status: cn.status
      });
      b.summaryMinor.sales -= nominalMinor;
      b.summaryMinor.salesBase -= baseMinor;
    });

    // Process Purchase Returns
    purchaseReturns.forEach(pr => {
      const code = pr.currency || baseCode;
      const b = getBucket(code, pr.transactionCurrencyId);
      const decimals = getCurrencyDecimals(code);
      const nominal = Number(pr.totalAmount || pr.subtotal || 0);
      const nominalMinor = toMinorUnits(nominal, decimals);
      const rate = Number(pr.exchangeRate || (code === baseCode ? 1 : b.exchangeRate) || 1);
      const baseMinor = convertToMinorBase(nominalMinor, rate);

      b.breakdown.push({
        transactionType: 'PurchaseReturn',
        nominal: fromMinorUnits(nominalMinor, decimals),
        volumeBaseCcy: fromMinorUnits(baseMinor, decimals),
        rate,
        status: pr.status
      });
      b.summaryMinor.purchases -= nominalMinor;
      b.summaryMinor.purchasesBase -= baseMinor;
    });

    // Process Standalone Payments
    standalonePayments.forEach(pay => {
      const code = pay.currency || baseCode;
      const nominal = Number(pay.amount || 0);
      const nominalMinor = toMinorUnits(nominal);
      const rate = Number(pay.exchangeRate || getRateDetails(code, baseCode).rate);
      const baseMinor = (code === baseCode) ? nominalMinor : convertToMinorBase(nominalMinor, rate);
      const b = getBucket(code, pay.transactionCurrencyId);
      b.breakdown.push({ transactionType: 'StandalonePayment', volumeBaseCcy: fromMinorUnits(baseMinor), nominal });
      b.summaryMinor.receivables += nominalMinor;
      b.summaryMinor.receivablesBase += baseMinor;
    });

    // Quotations / Orders (for breakdown reference)
    quotations.forEach(q => {
      const code = q.currency || baseCode;
      const nominal = Number(q.grandTotal || q.totalAmount || 0);
      const rate = Number(q.exchangeRate || getRateDetails(code, baseCode).rate);
      const baseAmt = (code === baseCode) ? nominal : Number((nominal * rate).toFixed(2));
      const b = getBucket(code, q.transactionCurrencyId);
      b.breakdown.push({ transactionType: 'Quotation', volumeBaseCcy: baseAmt, nominal });
    });

    salesOrders.forEach(so => {
      const code = so.currency || baseCode;
      const nominal = Number(so.totalAmount || 0);
      const rate = Number(so.exchangeRate || getRateDetails(code, baseCode).rate);
      const baseAmt = (code === baseCode) ? nominal : Number((nominal * rate).toFixed(2));
      const b = getBucket(code, so.transactionCurrencyId);
      b.breakdown.push({ transactionType: 'SalesOrder', volumeBaseCcy: baseAmt, nominal });
    });

    purchaseOrders.forEach(po => {
      const code = po.currencyCode || baseCode;
      const nominal = Number(po.totalAmount || 0);
      const rate = Number(po.exchangeRate || getRateDetails(code, baseCode).rate);
      const baseAmt = (code === baseCode) ? nominal : Number((nominal * rate).toFixed(2));
      const b = getBucket(code, po.transactionCurrencyId);
      b.breakdown.push({ transactionType: 'PurchaseOrder', volumeBaseCcy: baseAmt, nominal });
    });

    let usageValues = Object.values(grouped).map(b => {
      const foreignSales = fromMinorUnits(b.summaryMinor.sales);
      const bookedSalesBase = fromMinorUnits(b.summaryMinor.salesBase);
      const latestRate = Number(b.exchangeRate || 1);
      const valueAtLatestRate = b.currency === baseCode ? bookedSalesBase : roundHalfUp(foreignSales * latestRate, 2);

      return {
        currency: b.currency,
        currencyId: b.currencyId,
        exchangeRate: latestRate,
        rateDetails: b.rateDetails,
        breakdown: b.breakdown,
        isTaxInclusive: true,
        summary: {
          sales: foreignSales,
          salesBase: bookedSalesBase,
          valueAtLatestRate: valueAtLatestRate,
          purchases: fromMinorUnits(b.summaryMinor.purchases),
          purchasesBase: fromMinorUnits(b.summaryMinor.purchasesBase),
          receivables: fromMinorUnits(b.summaryMinor.receivables),
          receivablesBase: fromMinorUnits(b.summaryMinor.receivablesBase),
          payables: fromMinorUnits(b.summaryMinor.payables),
          payablesBase: fromMinorUnits(b.summaryMinor.payablesBase)
        },
        realizedFx: {
          gain: fromMinorUnits(b.realizedMinorGain),
          loss: fromMinorUnits(b.realizedMinorLoss),
          net: fromMinorUnits(b.realizedMinorGain - b.realizedMinorLoss)
        },
        unrealizedFx: {
          gain: fromMinorUnits(b.unrealizedMinorGain),
          loss: fromMinorUnits(b.unrealizedMinorLoss),
          net: fromMinorUnits(b.unrealizedMinorGain - b.unrealizedMinorLoss),
          openReceivables: fromMinorUnits(b.openReceivablesMinor),
          openPayables: fromMinorUnits(b.openPayablesMinor),
          revaluationRate: latestRate
        }
      };
    });

    if (currencyId) {
      usageValues = usageValues.filter(u => u.currencyId === currencyId || u.currency === currencyId);
    }

    const totals = {
      totalSalesBase: Number(usageValues.reduce((acc, u) => acc + (u.summary.salesBase || 0), 0).toFixed(2)),
      totalValueAtLatestRate: Number(usageValues.reduce((acc, u) => acc + (u.summary.valueAtLatestRate || 0), 0).toFixed(2)),
      totalPurchasesBase: Number(usageValues.reduce((acc, u) => acc + (u.summary.purchasesBase || 0), 0).toFixed(2)),
      totalReceivablesBase: Number(usageValues.reduce((acc, u) => acc + (u.summary.receivablesBase || 0), 0).toFixed(2)),
      totalPayablesBase: Number(usageValues.reduce((acc, u) => acc + (u.summary.payablesBase || 0), 0).toFixed(2)),
      netVolumeBase: Number(usageValues.reduce((acc, u) => acc + (u.summary.salesBase || 0) + (u.summary.purchasesBase || 0), 0).toFixed(2)),
      realizedFx: {
        totalGain: Number(usageValues.reduce((acc, u) => acc + (u.realizedFx?.gain || 0), 0).toFixed(2)),
        totalLoss: Number(usageValues.reduce((acc, u) => acc + (u.realizedFx?.loss || 0), 0).toFixed(2)),
        netFx: Number(usageValues.reduce((acc, u) => acc + (u.realizedFx?.net || 0), 0).toFixed(2))
      },
      unrealizedFx: {
        totalGain: Number(usageValues.reduce((acc, u) => acc + (u.unrealizedFx?.gain || 0), 0).toFixed(2)),
        totalLoss: Number(usageValues.reduce((acc, u) => acc + (u.unrealizedFx?.loss || 0), 0).toFixed(2)),
        netFx: Number(usageValues.reduce((acc, u) => acc + (u.unrealizedFx?.net || 0), 0).toFixed(2))
      },
      isTaxInclusive: true
    };

    // Itemize every bill for Statutory Purchases Reconciliation (Requirement 5)
    const billsReconciliation = bills.map(bill => {
      const code = bill.currency || (bill.transactionCurrencyId ? ccyById[bill.transactionCurrencyId]?.code : baseCode);
      const decimals = getCurrencyDecimals(code);
      const bookingRate = Number(bill.exchangeRate || (code === baseCode ? 1 : (getRateDetails(code, baseCode).rate || 1)));
      const subtotal = Number(bill.subtotal || 0);
      const tax = Number(bill.tax || 0);
      const total = Number(bill.totalAmount ?? (subtotal + tax - (bill.discount || 0)) ?? 0);
      const expectedBase = roundHalfUp(total * bookingRate, decimals);
      const baseCurrencyAmount = Number(bill.baseCurrencyAmount !== null && bill.baseCurrencyAmount !== undefined ? bill.baseCurrencyAmount : expectedBase);

      return {
        id: bill.id,
        billNumber: bill.billNumber || bill.id,
        billDate: bill.billDate,
        vendorName: bill.vendor?.name || bill.vendor?.companyName || 'Vendor',
        status: bill.status,
        currency: code,
        exchangeRate: bookingRate,
        subtotal,
        tax,
        total,
        baseCurrencyAmount
      };
    });

    const totalBillsSubtotalBase = roundHalfUp(billsReconciliation.reduce((sum, b) => {
      const bDecimals = getCurrencyDecimals(b.currency);
      return sum + (b.currency === baseCode ? b.subtotal : roundHalfUp(b.subtotal * b.exchangeRate, bDecimals));
    }, 0), 2);

    const totalBillsTaxBase = roundHalfUp(billsReconciliation.reduce((sum, b) => {
      const bDecimals = getCurrencyDecimals(b.currency);
      return sum + (b.currency === baseCode ? b.tax : roundHalfUp(b.tax * b.exchangeRate, bDecimals));
    }, 0), 2);

    const totalBillsVolumeBase = roundHalfUp(billsReconciliation.reduce((sum, b) => sum + b.baseCurrencyAmount, 0), 2);

    res.json({
      success: true,
      baseCurrency: baseCode,
      baseCurrencyDetails: {
        code: baseCode,
        symbol: baseSymbol,
        name: baseName
      },
      isTaxInclusive: true,
      totals,
      usage: usageValues,
      billsReconciliation,
      billsReconciliationSummary: {
        count: billsReconciliation.length,
        totalSubtotalBase: totalBillsSubtotalBase,
        totalTaxBase: totalBillsTaxBase,
        totalPurchasesVolumeBase: totalBillsVolumeBase,
        taxReportSum: roundHalfUp(totalBillsSubtotalBase + totalBillsTaxBase, 2),
        variance: roundHalfUp(Math.abs(totalBillsVolumeBase - (totalBillsSubtotalBase + totalBillsTaxBase)), 2),
        isReconciled: Math.abs(totalBillsVolumeBase - (totalBillsSubtotalBase + totalBillsTaxBase)) <= 0.05
      },
      dataQualityWarnings
    });
  } catch (error) {
    console.error('getCurrencyUsage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCurrencyGainLoss = async (req, res) => {
  try {
    const businessId = req.business.id; // STRICT SCOPING
    const { fromDate, toDate } = req.query;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });
    const baseCode = business?.baseCurrency?.code || business?.currencyCode || business?.currency || 'INR';

    const fxAccounts = await prisma.account.findMany({
      where: {
        businessId,
        OR: [
          { code: 'SYSTEM_FX_GAIN_LOSS' },
          { name: { contains: 'FX Gain', mode: 'insensitive' } }
        ]
      }
    });

    const fxAccountIds = fxAccounts.map(a => a.id);
    let breakdown = [];
    let transactions = [];

    if (fxAccountIds.length > 0) {
      const where = { businessId, accountId: { in: fxAccountIds } };
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = new Date(fromDate);
        if (toDate) where.date.lte = new Date(toDate);
      }

      const grouped = await prisma.journalEntry.groupBy({
        by: ['currency'],
        where,
        _sum: {
          baseDebit: true,
          baseCredit: true
        }
      });

      breakdown = grouped.map(g => ({
        currency: g.currency || 'UNKNOWN',
        realizedLoss: g._sum.baseDebit || 0,
        realizedGain: g._sum.baseCredit || 0,
        netGainLoss: (g._sum.baseCredit || 0) - (g._sum.baseDebit || 0)
      }));

      const rawTx = await prisma.journalEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      transactions = rawTx.map(t => ({
        id: t.id,
        date: t.date || t.createdAt,
        currency: t.currency || 'UNKNOWN',
        description: t.description || 'Realized FX Impact',
        realizedLoss: t.baseDebit || 0,
        realizedGain: t.baseCredit || 0,
        netGainLoss: (t.baseCredit || 0) - (t.baseDebit || 0)
      }));
    }

    // Also inspect settled payments on foreign-currency invoices and bills
    const invPayments = await prisma.payment.findMany({
      where: { businessId, invoiceId: { not: null } },
      include: { invoice: true }
    });

    const billPayments = await prisma.payment.findMany({
      where: { businessId, billId: { not: null } },
      include: { bill: true }
    });

    const computedTransactions = [];
    const computedMap = {};

    invPayments.forEach(pay => {
      if (!pay.invoice) return;
      const inv = pay.invoice;
      const c = inv.currency || baseCode;
      if (c === baseCode) return;

      const bookingRate = Number(inv.exchangeRate || 1);
      const settlementRate = Number(pay.exchangeRate || bookingRate);
      const settledAmt = Number(pay.amount || 0);

      const fx = calculateRealizedFx({
        type: 'RECEIVABLE',
        bookingRate,
        settlementRate,
        foreignAmountSettled: settledAmt
      });

      if (!computedMap[c]) computedMap[c] = { realizedGain: 0, realizedLoss: 0, netGainLoss: 0 };
      computedMap[c].realizedGain += fx.realizedGain;
      computedMap[c].realizedLoss += fx.realizedLoss;
      computedMap[c].netGainLoss += fx.realizedGainLoss;

      computedTransactions.push({
        id: pay.id,
        date: pay.paymentDate || pay.createdAt,
        currency: c,
        description: `Settlement of Invoice #${inv.invoiceNumber}: Booking Rate ${bookingRate} vs Settlement Rate ${settlementRate} on ${settledAmt} ${c}`,
        type: 'RECEIVABLE',
        documentNumber: inv.invoiceNumber,
        paymentNumber: pay.paymentNumber,
        bookingRate,
        settlementRate,
        foreignAmount: settledAmt,
        realizedLoss: fx.realizedLoss,
        realizedGain: fx.realizedGain,
        netGainLoss: fx.realizedGainLoss
      });
    });

    billPayments.forEach(pay => {
      if (!pay.bill) return;
      const bill = pay.bill;
      const c = bill.currency || baseCode;
      if (c === baseCode) return;

      const bookingRate = Number(bill.exchangeRate || 1);
      const settlementRate = Number(pay.exchangeRate || bookingRate);
      const settledAmt = Number(pay.amount || 0);

      const fx = calculateRealizedFx({
        type: 'PAYABLE',
        bookingRate,
        settlementRate,
        foreignAmountSettled: settledAmt
      });

      if (!computedMap[c]) computedMap[c] = { realizedGain: 0, realizedLoss: 0, netGainLoss: 0 };
      computedMap[c].realizedGain += fx.realizedGain;
      computedMap[c].realizedLoss += fx.realizedLoss;
      computedMap[c].netGainLoss += fx.realizedGainLoss;

      computedTransactions.push({
        id: pay.id,
        date: pay.paymentDate || pay.createdAt,
        currency: c,
        description: `Settlement of Bill #${bill.billNumber}: Booking Rate ${bookingRate} vs Settlement Rate ${settlementRate} on ${settledAmt} ${c} (Payable)`,
        type: 'PAYABLE',
        documentNumber: bill.billNumber,
        paymentNumber: pay.paymentNumber,
        bookingRate,
        settlementRate,
        foreignAmount: settledAmt,
        realizedLoss: fx.realizedLoss,
        realizedGain: fx.realizedGain,
        netGainLoss: fx.realizedGainLoss
      });
    });

    // If no journal entries exist, use the computed transactions and summary
    if (breakdown.length === 0 && Object.keys(computedMap).length > 0) {
      breakdown = Object.entries(computedMap).map(([curr, val]) => ({
        currency: curr,
        realizedGain: Number(val.realizedGain.toFixed(2)),
        realizedLoss: Number(val.realizedLoss.toFixed(2)),
        netGainLoss: Number(val.netGainLoss.toFixed(2))
      }));
    }

    if (transactions.length === 0 && computedTransactions.length > 0) {
      transactions = computedTransactions;
    }

    res.json({
      success: true,
      fxGainLoss: breakdown,
      transactions,
      details: computedTransactions
    });
  } catch (error) {
    console.error('getCurrencyGainLoss error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recalculateCurrencyFx = async (req, res) => {
  try {
    const businessId = req.business.id;

    let fxAccount = await prisma.account.findFirst({
      where: {
        businessId,
        OR: [
          { code: 'SYSTEM_FX_GAIN_LOSS' },
          { name: { contains: 'FX Gain', mode: 'insensitive' } }
        ]
      }
    });

    if (!fxAccount) {
      fxAccount = await prisma.account.create({
        data: {
          businessId,
          name: 'Realized FX Gain/Loss',
          code: 'SYSTEM_FX_GAIN_LOSS',
          type: 'EXPENSE',
          isActive: true
        }
      });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });
    const baseCode = business?.baseCurrency?.code || business?.currencyCode || business?.currency || 'INR';

    // 1. Process Invoice Settlements (Receivables)
    const invPayments = await prisma.payment.findMany({
      where: { businessId, invoiceId: { not: null } },
      include: { invoice: true }
    });

    for (const pay of invPayments) {
      if (!pay.invoice) continue;
      const inv = pay.invoice;
      const invCurrency = inv.currency || baseCode;
      
      if (invCurrency !== baseCode && inv.exchangeRate && pay.exchangeRate) {
        const invRate = Number(inv.exchangeRate);
        const payRate = Number(pay.exchangeRate);
        const amount = Number(pay.amount || 0);

        if (amount > 0) {
          const fx = calculateRealizedFx({
            type: 'RECEIVABLE',
            bookingRate: invRate,
            settlementRate: payRate,
            foreignAmountSettled: amount
          });

          if (fx.realizedGainLoss !== 0) {
            const existing = await prisma.journalEntry.findFirst({
              where: {
                businessId,
                accountId: fxAccount.id,
                description: { contains: pay.paymentNumber || pay.id }
              }
            });

            if (!existing) {
              if (fx.isGain) {
                await prisma.journalEntry.create({
                  data: {
                    businessId,
                    accountId: fxAccount.id,
                    debit: 0,
                    credit: fx.realizedGain,
                    baseDebit: 0,
                    baseCredit: fx.realizedGain,
                    currency: invCurrency,
                    exchangeRate: 1.0,
                    description: `Realized FX Gain on Payment ${pay.paymentNumber || pay.id} for Invoice #${inv.invoiceNumber}`,
                    date: pay.paymentDate || pay.createdAt
                  }
                });
              } else if (fx.isLoss) {
                await prisma.journalEntry.create({
                  data: {
                    businessId,
                    accountId: fxAccount.id,
                    debit: fx.realizedLoss,
                    credit: 0,
                    baseDebit: fx.realizedLoss,
                    baseCredit: 0,
                    currency: invCurrency,
                    exchangeRate: 1.0,
                    description: `Realized FX Loss on Payment ${pay.paymentNumber || pay.id} for Invoice #${inv.invoiceNumber}`,
                    date: pay.paymentDate || pay.createdAt
                  }
                });
              }
            }
          }
        }
      }
    }

    // 2. Process Bill Settlements (Payables - reverse sign)
    const billPayments = await prisma.payment.findMany({
      where: { businessId, billId: { not: null } },
      include: { bill: true }
    });

    for (const pay of billPayments) {
      if (!pay.bill) continue;
      const bill = pay.bill;
      const billCurrency = bill.currency || baseCode;

      if (billCurrency !== baseCode && bill.exchangeRate && pay.exchangeRate) {
        const billRate = Number(bill.exchangeRate);
        const payRate = Number(pay.exchangeRate);
        const amount = Number(pay.amount || 0);

        if (amount > 0) {
          const fx = calculateRealizedFx({
            type: 'PAYABLE',
            bookingRate: billRate,
            settlementRate: payRate,
            foreignAmountSettled: amount
          });

          if (fx.realizedGainLoss !== 0) {
            const existing = await prisma.journalEntry.findFirst({
              where: {
                businessId,
                accountId: fxAccount.id,
                description: { contains: pay.paymentNumber || pay.id }
              }
            });

            if (!existing) {
              if (fx.isGain) {
                await prisma.journalEntry.create({
                  data: {
                    businessId,
                    accountId: fxAccount.id,
                    debit: 0,
                    credit: fx.realizedGain,
                    baseDebit: 0,
                    baseCredit: fx.realizedGain,
                    currency: billCurrency,
                    exchangeRate: 1.0,
                    description: `Realized FX Gain on Payment ${pay.paymentNumber || pay.id} for Bill #${bill.billNumber}`,
                    date: pay.paymentDate || pay.createdAt
                  }
                });
              } else if (fx.isLoss) {
                await prisma.journalEntry.create({
                  data: {
                    businessId,
                    accountId: fxAccount.id,
                    debit: fx.realizedLoss,
                    credit: 0,
                    baseDebit: fx.realizedLoss,
                    baseCredit: 0,
                    currency: billCurrency,
                    exchangeRate: 1.0,
                    description: `Realized FX Loss on Payment ${pay.paymentNumber || pay.id} for Bill #${bill.billNumber}`,
                    date: pay.paymentDate || pay.createdAt
                  }
                });
              }
            }
          }
        }
      }
    }

    return exports.getCurrencyGainLoss(req, res);
  } catch (error) {
    console.error('recalculateCurrencyFx error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// PROFIT & LOSS (SYNTHETIC LEDGER)
//////////////////////////////////////////////////////
exports.getProfitLoss = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const invoiceWhere = { businessId: req.business.id, isDeleted: false, status: { not: "CANCELLED" } };
    const expenseWhere = { businessId: req.business.id };
    
    if (fromDate || toDate) {
      invoiceWhere.invoiceDate = {};
      expenseWhere.date = {};
      if (fromDate) {
        invoiceWhere.invoiceDate.gte = new Date(fromDate);
        expenseWhere.date.gte = new Date(fromDate);
      }
      if (toDate) {
        invoiceWhere.invoiceDate.lte = new Date(toDate);
        expenseWhere.date.lte = new Date(toDate);
      }
    }

    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: invoiceWhere
    });

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: expenseWhere
    });

    let income = invoiceAgg._sum.grandTotal || 0;
    let expense = expenseAgg._sum.amount || 0;
    
    const profit = income - expense;

    res.json({
      success: true,
      income,
      expense,
      profit,
      status: profit >= 0 ? "PROFIT" : "LOSS"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// BALANCE SHEET (SYNTHETIC LEDGER)
//////////////////////////////////////////////////////
exports.getBalanceSheet = async (req, res) => {
  try {
    const { asOfDate } = req.query;

    const invoiceDateFilter = asOfDate ? { invoiceDate: { lte: new Date(asOfDate) } } : {};
    const paymentDateFilter = asOfDate ? { paymentDate: { lte: new Date(asOfDate) } } : {};
    const expenseDateFilter = asOfDate ? { date: { lte: new Date(asOfDate) } } : {};

    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId: req.business.id, isDeleted: false, status: { not: "CANCELLED" }, ...invoiceDateFilter }
    });

    const billAgg = await prisma.bill.aggregate({
      _sum: { totalAmount: true },
      where: { businessId: req.business.id, ...expenseDateFilter }
    });

    const customerPaymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id, billId: null, ...paymentDateFilter }
    });

    const vendorPaymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id, billId: { not: null }, ...paymentDateFilter }
    });

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id, ...expenseDateFilter }
    });

    const totalInvoices = invoiceAgg._sum.grandTotal || 0;
    const totalBills = billAgg._sum.totalAmount || 0;
    const customerPayments = customerPaymentAgg._sum.amount || 0;
    const vendorPayments = vendorPaymentAgg._sum.amount || 0;
    const directExpenses = expenseAgg._sum.amount || 0;

    const cashBalance = customerPayments - vendorPayments - directExpenses;
    const accountsReceivable = totalInvoices - customerPayments;
    const accountsPayable = totalBills - vendorPayments;
    const retainedEarnings = totalInvoices - totalBills - directExpenses;

    const assets = [
      { id: 'cash', name: 'Cash & Bank', balance: cashBalance },
      { id: 'ar', name: 'Accounts Receivable', balance: accountsReceivable > 0 ? accountsReceivable : 0 }
    ];

    const liabilities = [
      { id: 'ap', name: 'Accounts Payable', balance: accountsPayable > 0 ? accountsPayable : 0 }
    ];
    if (accountsReceivable < 0) {
      liabilities.push({ id: 'advances', name: 'Customer Advances', balance: Math.abs(accountsReceivable) });
    }

    const equities = [
      { id: 'retained_earnings', name: 'Retained Earnings', balance: retainedEarnings }
    ];

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equities.reduce((sum, e) => sum + e.balance, 0);

    const balances = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    res.json({
      success: true,
      assets,
      liabilities,
      equities,
      totalAssets,
      totalLiabilities,
      totalEquity,
      balances
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// CASH FLOW STATEMENT (SYNTHETIC)
//////////////////////////////////////////////////////
exports.getCashFlow = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const paymentWhere = { businessId: req.business.id };
    const expenseWhere = { businessId: req.business.id };
    
    if (fromDate || toDate) {
      paymentWhere.paymentDate = {};
      expenseWhere.date = {};
      if (fromDate) {
        paymentWhere.paymentDate.gte = new Date(fromDate);
        expenseWhere.date.gte = new Date(fromDate);
      }
      if (toDate) {
        paymentWhere.paymentDate.lte = new Date(toDate);
        expenseWhere.date.lte = new Date(toDate);
      }
    }

    const customerPaymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { ...paymentWhere, billId: null }
    });
    
    const vendorPaymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { ...paymentWhere, billId: { not: null } }
    });

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: expenseWhere
    });

    const operatingInflow = customerPaymentAgg._sum.amount || 0;
    const operatingOutflow = (expenseAgg._sum.amount || 0) + (vendorPaymentAgg._sum.amount || 0);
    
    const netOperating = operatingInflow - operatingOutflow;

    res.json({
      success: true,
      operatingActivities: [
        { name: 'Receipts from Customers', amount: operatingInflow },
        { name: 'Payments to Suppliers & Expenses', amount: -operatingOutflow }
      ],
      investingActivities: [],
      financingActivities: [],
      netCashFlow: netOperating,
      openingBalance: 0, // Simplified without full ledger history
      closingBalance: netOperating
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// TRIAL BALANCE (REAL LEDGER)
//////////////////////////////////////////////////////
exports.getTrialBalance = async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { businessId: req.business.id, isActive: true },
      include: {
        entries: {
          select: { debit: true, credit: true }
        }
      }
    });

    let totalDebit = 0;
    let totalCredit = 0;

    const result = accounts.map(a => {
      let debitSum = 0;
      let creditSum = 0;
      a.entries.forEach(e => {
        debitSum += (e.debit || 0);
        creditSum += (e.credit || 0);
      });

      let netDebit = 0;
      let netCredit = 0;

      if (debitSum > creditSum) {
        netDebit = debitSum - creditSum;
        totalDebit += netDebit;
      } else if (creditSum > debitSum) {
        netCredit = creditSum - debitSum;
        totalCredit += netCredit;
      }

      return {
        id: a.id,
        name: a.name,
        code: a.code,
        type: a.type,
        netDebit,
        netCredit
      };
    }).filter(a => a.netDebit > 0 || a.netCredit > 0);

    const balances = Math.abs(totalDebit - totalCredit) < 0.01;

    res.json({
      success: true,
      accounts: result,
      totalDebit,
      totalCredit,
      balances
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// GENERAL LEDGER (REAL LEDGER)
//////////////////////////////////////////////////////
exports.getGeneralLedger = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const accountId = req.query.accountId;
    
    const whereClause = { businessId: req.business.id };
    if (accountId && accountId !== 'all') {
      whereClause.accountId = accountId;
    }

    const totalCount = await prisma.journalEntry.count({ where: whereClause });
    
    const entries = await prisma.journalEntry.findMany({
      where: whereClause,
      include: {
        account: { select: { name: true, code: true, type: true } }
      },
      orderBy: { date: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    });

    let runningBalance = 0;
    // Calculate running balance up to the first item if paginated
    if (page > 1 && entries.length > 0) {
       const previousEntries = await prisma.journalEntry.aggregate({
         _sum: { debit: true, credit: true },
         where: { 
           businessId: req.business.id,
           ...(accountId && accountId !== 'all' ? { accountId } : {}),
           date: { lt: entries[0].date }
         }
       });
       // Depends on account type, but generically:
       runningBalance = (previousEntries._sum.debit || 0) - (previousEntries._sum.credit || 0);
    }

    const mappedEntries = entries.map(e => {
      runningBalance += (e.debit || 0) - (e.credit || 0);
      return {
        id: e.id,
        date: e.date,
        account: e.account,
        description: e.description,
        debit: e.debit,
        credit: e.credit,
        runningBalance
      };
    });

    res.json({
      success: true,
      entries: mappedEntries,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// ACCOUNTS RECEIVABLE
//////////////////////////////////////////////////////
exports.getAccountsReceivable = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;

    // We only want invoices where grandTotal > amountPaid
    // Prisma doesn't support comparing two columns directly in where easily, 
    // but typically balanceDue is grandTotal - amountPaid. 
    // We'll fetch unpaid/partially paid status.
    const whereClause = {
      businessId: req.business.id,
      isDeleted: false,
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] }
    };

    const totalCount = await prisma.invoice.count({ where: whereClause });

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        customer: { select: { company: true } }
      },
      orderBy: { dueDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    });

    // DB-side aggregation for buckets
    // Since prisma doesn't support dynamic bucket aggregation natively in aggregate(),
    // we use a groupBy or raw query, but to keep it safe we can fetch all open invoices for bucketing
    // or use a raw query. To keep it simple and DB-friendly, we can fetch just dates/amounts.
    const allOpenInvoices = await prisma.invoice.findMany({
      where: whereClause,
      select: { grandTotal: true, amountPaid: true, dueDate: true }
    });

    const buckets = {
      current: { count: 0, total: 0 },
      thirty: { count: 0, total: 0 },
      sixty: { count: 0, total: 0 },
      ninety: { count: 0, total: 0 },
      older: { count: 0, total: 0 }
    };

    const now = new Date();
    
    allOpenInvoices.forEach(inv => {
      const balance = (inv.grandTotal || 0) - (inv.amountPaid || 0);
      if (balance <= 0) return;
      
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date();
      const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        buckets.current.count++; buckets.current.total += balance;
      } else if (diffDays <= 30) {
        buckets.thirty.count++; buckets.thirty.total += balance;
      } else if (diffDays <= 60) {
        buckets.sixty.count++; buckets.sixty.total += balance;
      } else if (diffDays <= 90) {
        buckets.ninety.count++; buckets.ninety.total += balance;
      } else {
        buckets.older.count++; buckets.older.total += balance;
      }
    });

    const mappedInvoices = invoices.map(inv => {
      const balance = (inv.grandTotal || 0) - (inv.amountPaid || 0);
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date();
      const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
      let status = 'current';
      if (diffDays > 0) status = 'overdue';
      else if (diffDays > -7) status = 'due soon';
      
      return {
        id: inv.id,
        customerName: inv.customer?.company || inv.customer?.name || 'Unknown',
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        amount: inv.grandTotal,
        balanceDue: balance,
        daysOverdue: diffDays > 0 ? diffDays : 0,
        status
      };
    }).filter(i => i.balanceDue > 0);

    res.json({
      success: true,
      invoices: mappedInvoices,
      buckets,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// ACCOUNTS PAYABLE
//////////////////////////////////////////////////////
exports.getAccountsPayable = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;

    const whereClause = {
      businessId: req.business.id,
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] }
    };

    const totalCount = await prisma.bill.count({ where: whereClause });

    const bills = await prisma.bill.findMany({
      where: whereClause,
      include: {
        vendor: { select: { name: true, companyName: true } }
      },
      orderBy: { dueDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const allOpenBills = await prisma.bill.findMany({
      where: whereClause,
      select: { outstandingAmount: true, dueDate: true }
    });

    const buckets = {
      current: { count: 0, total: 0 },
      thirty: { count: 0, total: 0 },
      sixty: { count: 0, total: 0 },
      ninety: { count: 0, total: 0 },
      older: { count: 0, total: 0 }
    };

    const now = new Date();
    
    allOpenBills.forEach(b => {
      const balance = b.outstandingAmount || 0;
      if (balance <= 0) return;
      
      const due = b.dueDate ? new Date(b.dueDate) : new Date();
      const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        buckets.current.count++; buckets.current.total += balance;
      } else if (diffDays <= 30) {
        buckets.thirty.count++; buckets.thirty.total += balance;
      } else if (diffDays <= 60) {
        buckets.sixty.count++; buckets.sixty.total += balance;
      } else if (diffDays <= 90) {
        buckets.ninety.count++; buckets.ninety.total += balance;
      } else {
        buckets.older.count++; buckets.older.total += balance;
      }
    });

    const mappedBills = bills.map(b => {
      const balance = b.outstandingAmount || 0;
      const due = b.dueDate ? new Date(b.dueDate) : new Date();
      const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
      let status = 'current';
      if (diffDays > 0) status = 'overdue';
      else if (diffDays > -7) status = 'due soon';
      
      return {
        id: b.id,
        vendorName: b.vendor?.companyName || b.vendor?.name || 'Unknown',
        billNumber: b.billNumber,
        billDate: b.billDate,
        dueDate: b.dueDate,
        amount: b.totalAmount,
        balanceDue: balance,
        daysOverdue: diffDays > 0 ? diffDays : 0,
        status
      };
    }).filter(i => i.balanceDue > 0);

    res.json({
      success: true,
      bills: mappedBills,
      buckets,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// OTHER EXISTING ENDPOINTS (Preserved for compatibility)
//////////////////////////////////////////////////////
exports.getStockValuation = async (req, res) => {
  res.json({ success: true, stockValuation: { totalValue: 0, totalItems: 0, items: [] } });
};

exports.getLowStockAlerts = async (req, res) => {
  res.json({ success: true, alerts: [] });
};

exports.getMovementSummary = async (req, res) => {
  res.json({ success: true, summary: [] });
};
