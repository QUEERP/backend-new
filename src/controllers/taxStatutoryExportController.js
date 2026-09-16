const prisma = require("../config/prisma");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const statutoryRegistry = require("../config/reports/statutoryRegistry");
const { buildPDF, sendExcel, sendJSON } = require("../utils/exportUtils");



// -------------------------------------------------------------
// Tax Summary
// -------------------------------------------------------------
const getTaxSummaryData = async (req) => {
  const businessId = req.business.id; // STRICT SCOPING
  const { fromDate, toDate, taxFrameworkId, taxTypeId, taxRateId, transactionType } = req.query;

  const where = { businessId };
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }
  if (transactionType) where.transactionType = transactionType;
  if (taxRateId) where.taxRateId = taxRateId;

  if (taxFrameworkId || taxTypeId) {
    where.taxRate = { taxType: {} };
    if (taxTypeId || taxFrameworkId) {
      where.OR = where.OR || [];
      if (taxTypeId) {
        where.OR.push({ taxRate: { taxType: { id: taxTypeId } } }, { overrideTaxTypeId: taxTypeId });
      }
      if (taxFrameworkId) {
        where.OR.push({ taxRate: { taxType: { taxFrameworkId } } }, { overrideTaxType: { taxFrameworkId } });
      }
    }
  }

  const summary = await prisma.taxTransaction.groupBy({
    by: ['transactionType', 'taxRateId', 'transactionCurrencyId'],
    where,
    _sum: {
      taxAmountBaseCcy: true,
      taxAmountTxnCcy: true
    }
  });

  const rateIds = summary.map(s => s.taxRateId);
  const rates = await prisma.taxRate.findMany({
    where: { id: { in: rateIds } },
    include: { taxType: true }
  });
  
  const rateMap = {};
  rates.forEach(r => { rateMap[r.id] = r; });

  const currencyIds = [...new Set(summary.map(s => s.transactionCurrencyId).filter(Boolean))];
  const currencies = await prisma.currency.findMany({ where: { id: { in: currencyIds } } });
  const ccyMap = {};
  currencies.forEach(c => { ccyMap[c.id] = c.code; });

  return summary.map(s => {
    const rate = rateMap[s.taxRateId];
    return {
      transactionType: s.transactionType,
      transactionCurrency: s.transactionCurrencyId ? (ccyMap[s.transactionCurrencyId] || 'UNKNOWN') : 'BASE',
      taxType: rate?.taxType?.name || 'N/A',
      taxRate: rate?.rate || 0,
      totalTaxBaseCcy: s._sum.taxAmountBaseCcy || 0,
      totalTaxTxnCcy: s._sum.taxAmountTxnCcy || 0
    };
  });
};

exports.exportTaxSummary = async (req, res) => {
  try {
    const format = req.params.format;
    const data = await getTaxSummaryData(req);

    if (format === 'json') {
      return sendJSON(res, 'Tax_Summary', data);
    }

    if (format === 'excel') {
      const excelData = data.map(d => ({
        "Transaction Type": d.transactionType,
        "Currency": d.transactionCurrency,
        "Tax Type": d.taxType,
        "Tax Rate (%)": d.taxRate,
        "Total Tax (Txn Ccy)": d.totalTaxTxnCcy,
        "Total Tax (Base Ccy)": d.totalTaxBaseCcy
      }));
      return sendExcel(res, 'Tax_Summary', 'Summary', excelData);
    }

    if (format === 'pdf') {
      const headers = ['Type', 'Currency', 'Tax Type', 'Rate (%)', 'Tax (Txn Ccy)', 'Tax (Base Ccy)'];
      const widths = [120, 80, 150, 70, 120, 120];
      const rows = data.map(d => [
        d.transactionType,
        d.transactionCurrency,
        d.taxType,
        d.taxRate,
        Number(d.totalTaxTxnCcy).toFixed(2),
        Number(d.totalTaxBaseCcy).toFixed(2)
      ]);
      return buildPDF(res, 'Tax_Summary', headers, widths, rows);
    }

    res.status(400).json({ success: false, message: 'Invalid format' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------------------------------------------------
// Tax Transactions
// -------------------------------------------------------------
const getTaxTransactionsData = async (req) => {
  const businessId = req.business.id; // STRICT SCOPING
  const { fromDate, toDate, taxFrameworkId, taxTypeId, taxRateId, transactionType } = req.query;

  const where = { businessId };
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }
  if (transactionType) where.transactionType = transactionType;
  if (taxRateId) where.taxRateId = taxRateId;

  if (taxFrameworkId || taxTypeId) {
    where.taxRate = { taxType: {} };
    if (taxTypeId || taxFrameworkId) {
      where.OR = where.OR || [];
      if (taxTypeId) {
        where.OR.push({ taxRate: { taxType: { id: taxTypeId } } }, { overrideTaxTypeId: taxTypeId });
      }
      if (taxFrameworkId) {
        where.OR.push({ taxRate: { taxType: { taxFrameworkId } } }, { overrideTaxType: { taxFrameworkId } });
      }
    }
  }
  
  const transactions = await prisma.taxTransaction.findMany({
    where,
    include: {
      taxRate: { include: { taxType: true } },
      transactionCurrency: true,
      business: { include: { baseCurrency: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return transactions.map(t => {
    // Infer exchange rate if not directly available (usually taxAmountBaseCcy / taxAmountTxnCcy)
    let exchangeRate = 1;
    if (t.taxAmountTxnCcy && t.taxAmountBaseCcy && t.taxAmountTxnCcy !== 0) {
      exchangeRate = Math.abs(t.taxAmountBaseCcy / t.taxAmountTxnCcy);
    }
    
    return {
      date: t.createdAt,
      type: t.transactionType,
      reference: t.transactionId || 'N/A', // transactionId is the reference
      taxType: t.taxRate?.taxType?.name || 'N/A',
      taxRate: t.taxRate?.rate || 0,
      transactionCurrency: t.transactionCurrency?.code || 'BASE',
      baseCurrency: t.business?.baseCurrency?.code || 'BASE',
      exchangeRate: exchangeRate,
      taxAmountTxnCcy: t.taxAmountTxnCcy || 0,
      taxAmountBaseCcy: t.taxAmountBaseCcy || 0
    };
  });
};

exports.exportTaxTransactions = async (req, res) => {
  try {
    const format = req.params.format;
    const data = await getTaxTransactionsData(req);

    if (format === 'json') {
      return sendJSON(res, 'Tax_Transactions', data);
    }

    if (format === 'excel') {
      const excelData = data.map(d => ({
        "Date": new Date(d.date).toLocaleString(),
        "Type": d.type,
        "Reference": d.reference,
        "Tax Type": d.taxType,
        "Rate (%)": d.taxRate,
        "Txn Ccy": d.transactionCurrency,
        "Base Ccy": d.baseCurrency,
        "Exch Rate": d.exchangeRate,
        "Tax Amount (Txn)": d.taxAmountTxnCcy,
        "Tax Amount (Base)": d.taxAmountBaseCcy
      }));
      return sendExcel(res, 'Tax_Transactions', 'Transactions', excelData);
    }

    if (format === 'pdf') {
      const headers = ['Date', 'Type', 'Tax Type', 'Rate', 'Txn Ccy', 'Base Ccy', 'Exch Rate', 'Tax (Txn)', 'Tax (Base)'];
      // A4 landscape width is ~842. Margins 40 each side = 762 available width
      const widths = [80, 100, 100, 40, 60, 60, 60, 80, 80];
      const rows = data.map(d => [
        new Date(d.date).toLocaleDateString(),
        d.type,
        d.taxType,
        d.taxRate,
        d.transactionCurrency,
        d.baseCurrency,
        Number(d.exchangeRate).toFixed(4),
        Number(d.taxAmountTxnCcy).toFixed(2),
        Number(d.taxAmountBaseCcy).toFixed(2)
      ]);
      return buildPDF(res, 'Tax_Transactions', headers, widths, rows);
    }

    res.status(400).json({ success: false, message: 'Invalid format' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------------------------------------------------
// Statutory Reports
// -------------------------------------------------------------
exports.exportStatutoryReport = async (req, res) => {
  try {
    const businessId = req.business.id; // STRICT SCOPING
    const { reportCode, format } = req.params;
    const filters = req.query;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { taxFramework: true }
    });

    if (!business || !business.taxFramework) {
      return res.status(400).json({ success: false, message: "No tax framework configured for this business" });
    }

    const frameworkName = business.taxFramework.name;
    const reportData = await statutoryRegistry.generateReport(frameworkName, reportCode, businessId, filters);
    
    if (!reportData || !reportData.data) {
      return res.status(400).json({ success: false, message: "Report generated no data" });
    }

    const reportName = reportData.reportName || reportCode;
    const rows = Array.isArray(reportData.data) ? reportData.data : [reportData.data];

    if (format === 'json') {
      return sendJSON(res, reportName.replace(/\s+/g, '_'), reportData.data);
    }

    if (format === 'excel') {
      return sendExcel(res, reportName.replace(/\s+/g, '_'), 'Report', rows);
    }

    if (format === 'pdf') {
      let headers = [];
      if (rows.length > 0 && typeof rows[0] === 'object') {
        headers = Object.keys(rows[0]);
      }
      
      const widthPerCol = headers.length > 0 ? Math.floor(740 / headers.length) : 100;
      const widths = headers.map(() => widthPerCol);
      
      const dataRows = rows.map(r => {
        return headers.map(h => typeof r[h] === 'object' ? JSON.stringify(r[h]) : r[h]);
      });

      return buildPDF(res, reportName, headers, widths, dataRows, business.name);
    }

    res.status(400).json({ success: false, message: 'Invalid format' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
