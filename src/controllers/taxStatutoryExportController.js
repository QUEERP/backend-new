const prisma = require("../config/prisma");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const statutoryRegistry = require("../config/reports/statutoryRegistry");
const { buildPDF, sendExcel, sendJSON, sendCSV } = require("../utils/exportUtils");



const gstTaxReportService = require("../services/gstTaxReportService");

// -------------------------------------------------------------
// Tax Summary
// -------------------------------------------------------------
const getTaxSummaryData = async (req) => {
  const businessId = req.business.id; // STRICT SCOPING
  const { fromDate, toDate } = req.query;

  const result = await gstTaxReportService.generateGstTaxSummary({
    businessId,
    fromDate,
    toDate
  });
  return result.summary || [];
};

exports.exportTaxSummary = async (req, res) => {
  try {
    const format = req.params.format;
    const data = await getTaxSummaryData(req);

    if (format === 'json') {
      return sendJSON(res, 'Tax_Summary', data);
    }

    if (format === 'csv') {
      const csvData = data.map(d => ({
        "Category": d.category,
        "Transaction Type": d.transactionType,
        "Document #": d.documentNumber,
        "Party": d.partyName,
        "Date": d.documentDate ? new Date(d.documentDate).toLocaleDateString() : '',
        "Currency": d.transactionCurrency,
        "Tax Type": d.taxType,
        "Tax Rate (%)": d.taxRate,
        "Taxable Amount (Txn Ccy)": d.taxableAmountTxnCcy,
        "Taxable Amount (Base Ccy)": d.taxableAmountBaseCcy,
        "Total Tax (Txn Ccy)": d.totalTaxTxnCcy,
        "Total Tax (Base Ccy)": d.totalTaxBaseCcy
      }));
      return sendCSV(res, 'Tax_Summary', csvData);
    }

    if (format === 'excel') {
      const excelData = data.map(d => ({
        "Category": d.category,
        "Transaction Type": d.transactionType,
        "Document #": d.documentNumber,
        "Party": d.partyName,
        "Date": d.documentDate ? new Date(d.documentDate).toLocaleDateString() : '',
        "Currency": d.transactionCurrency,
        "Tax Type": d.taxType,
        "Tax Rate (%)": d.taxRate,
        "Taxable Amount (Txn Ccy)": d.taxableAmountTxnCcy,
        "Taxable Amount (Base Ccy)": d.taxableAmountBaseCcy,
        "Total Tax (Txn Ccy)": d.totalTaxTxnCcy,
        "Total Tax (Base Ccy)": d.totalTaxBaseCcy
      }));
      return sendExcel(res, 'Tax_Summary', 'Summary', excelData);
    }

    if (format === 'pdf') {
      const businessId = req.business.id;
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: { baseCurrency: true }
      });
      const settings = await prisma.settings.findUnique({ where: { businessId } }).catch(() => null);

      let outputTaxBase = 0;
      let inputTaxBase = 0;
      let totalTaxableBase = 0;

      data.forEach(d => {
        const cat = (d.category || '').toLowerCase();
        const tax = Number(d.totalTaxBaseCcy) || 0;
        const taxable = Number(d.taxableAmountBaseCcy) || 0;
        totalTaxableBase += taxable;
        if (cat.includes('output') || cat.includes('sales')) {
          outputTaxBase += tax;
        } else if (cat.includes('input') || cat.includes('purchases')) {
          inputTaxBase += tax;
        }
      });
      const netTax = outputTaxBase - inputTaxBase;
      const sym = business?.baseCurrency?.symbol || '₹';
      const baseCcy = business?.baseCurrency?.code || 'INR';

      const fromDate = req.query.fromDate;
      const toDate = req.query.toDate;
      const periodLabel = fromDate && toDate
        ? `${new Date(fromDate).toLocaleDateString()} — ${new Date(toDate).toLocaleDateString()}`
        : (fromDate ? `From ${new Date(fromDate).toLocaleDateString()}` : (toDate ? `Up to ${new Date(toDate).toLocaleDateString()}` : 'Current Financial Year'));

      const kpis = [
        { label: 'OUTPUT TAX (SALES)', value: `${sym} ${outputTaxBase.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subtext: 'Tax collected on posted sales' },
        { label: 'INPUT TAX CREDIT (ITC)', value: `${sym} ${inputTaxBase.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subtext: 'Eligible credit on purchases' },
        { label: netTax >= 0 ? 'NET TAX PAYABLE' : 'NET ITC CARRY FORWARD', value: `${sym} ${Math.abs(netTax).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subtext: netTax >= 0 ? 'Statutory liability' : 'Credit for future periods' },
        { label: 'TAXABLE TURNOVER', value: `${sym} ${totalTaxableBase.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subtext: 'Total taxable base amount' },
      ];

      const headers = ['Category', 'Doc #', 'Party Name', 'Tax Type', 'Rate (%)', `Taxable Val (${baseCcy})`, `Tax Amount (${baseCcy})`];
      const widths = [110, 75, 120, 85, 55, 80, 80];
      const rows = data.map(d => [
        d.category,
        d.documentNumber,
        d.partyName || '-',
        d.taxType,
        `${d.taxRate}%`,
        Number(d.taxableAmountBaseCcy).toFixed(2),
        Number(d.totalTaxBaseCcy).toFixed(2)
      ]);

      const totalsRow = {
        'Category': 'Total Tax Turnover',
        'Doc #': '',
        'Party Name': '',
        'Tax Type': '',
        'Rate (%)': '',
        [`Taxable Val (${baseCcy})`]: `${sym} ${totalTaxableBase.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        [`Tax Amount (${baseCcy})`]: `${sym} ${(outputTaxBase + inputTaxBase).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      };

      return await buildPDF(res, 'Statutory GST & Tax Summary', headers, widths, rows, business?.name || req.business.name, {
        subtitle: 'Statutory GST Summary & Periodic Tax Returns Audit',
        business: business || { name: req.business.name },
        settings: settings || { companyName: req.business.name },
        period: periodLabel,
        kpis,
        totals: totalsRow,
        currencySymbol: sym,
        baseCurrency: baseCcy
      });
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
    const matchingRates = await prisma.taxRate.findMany({
      where: {
        ...(taxTypeId ? { taxTypeId } : {}),
        ...(taxFrameworkId ? { taxType: { taxFrameworkId } } : {})
      },
      select: { id: true }
    });
    where.taxRateId = { in: matchingRates.map(r => r.id) };
  }
  
  const rawTransactions = await prisma.taxTransaction.findMany({
    where,
    include: {
      transactionCurrency: true,
      business: { include: { baseCurrency: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const rateIds = rawTransactions.map(t => t.taxRateId).filter(Boolean);
  const rates = await prisma.taxRate.findMany({
    where: { id: { in: rateIds } },
    include: { taxType: true }
  });
  const rateMap = {};
  rates.forEach(r => { rateMap[r.id] = r; });

  const transactions = rawTransactions.map(t => ({
    ...t,
    taxRate: t.taxRateId ? rateMap[t.taxRateId] : null
  }));

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

    if (format === 'csv') {
      const csvData = data.map(d => ({
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
      return sendCSV(res, 'Tax_Transactions', csvData);
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
      include: { taxFramework: true, baseCurrency: true }
    });

    if (!business || !business.taxFramework) {
      return res.status(400).json({ success: false, message: "No tax framework configured for this business" });
    }

    const settings = await prisma.settings.findUnique({ where: { businessId } }).catch(() => null);

    const frameworkName = business.taxFramework.name;
    const reportData = await statutoryRegistry.generateReport(frameworkName, reportCode, businessId, filters);
    
    if (!reportData || (!reportData.data && !reportData.sections)) {
      return res.status(400).json({ success: false, message: "Report generated no data" });
    }

    const reportName = reportData.reportName || reportCode;
    const sym = business?.baseCurrency?.symbol || '₹';
    const baseCcy = business?.baseCurrency?.code || 'INR';

    const fromDate = filters.fromDate || filters.startDate;
    const toDate = filters.toDate || filters.endDate;
    const periodLabel = fromDate && toDate
      ? `${new Date(fromDate).toLocaleDateString('en-IN')} — ${new Date(toDate).toLocaleDateString('en-IN')}`
      : (fromDate ? `From ${new Date(fromDate).toLocaleDateString('en-IN')}` : (toDate ? `Up to ${new Date(toDate).toLocaleDateString('en-IN')}` : 'All Historic Records'));

    const rows = Array.isArray(reportData.data) ? reportData.data : (reportData.sections ? reportData.sections.flatMap(s => s.data || []) : [reportData.data]);

    // Format human-friendly header title
    const formatHeader = (key) => {
      const map = {
        taxRate: 'Tax Rate (%)',
        taxableAmount: `Taxable Value (${baseCcy})`,
        taxableValue: `Taxable Value (${baseCcy})`,
        CGST: `CGST (${baseCcy})`,
        SGST: `SGST (${baseCcy})`,
        IGST: `IGST (${baseCcy})`,
        CESS: `Cess (${baseCcy})`,
        totalTax: `Total GST (${baseCcy})`,
        totalTaxBaseCcy: `Total GST (${baseCcy})`,
        totalAmount: `Total Value (${baseCcy})`,
        invoiceCount: 'Invoices Count',
        category: 'Statutory Category',
        amount: `Amount (${baseCcy})`,
        vatAmount: `VAT (${baseCcy})`,
        box: 'Box #'
      };
      if (map[key]) return map[key];
      return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    };

    if (format === 'json') {
      return sendJSON(res, reportName.replace(/\s+/g, '_'), reportData);
    }

    if (reportCode === 'GSTR1') {
      // -------------------------------------------------------------
      // GSTR-1 Specific Premium Multi-Table Export
      // -------------------------------------------------------------
      if (format === 'csv') {
        const csvData = (reportData.data || []).map(r => ({
          "Tax Rate (%)": `${r.taxRate}%`,
          [`Taxable Value (${baseCcy})`]: Number(r.taxableAmount || 0).toFixed(2),
          [`CGST (${baseCcy})`]: Number(r.CGST || 0).toFixed(2),
          [`SGST (${baseCcy})`]: Number(r.SGST || 0).toFixed(2),
          [`IGST (${baseCcy})`]: Number(r.IGST || 0).toFixed(2),
          [`Total GST (${baseCcy})`]: Number(r.totalTax || r.totalTaxBaseCcy || 0).toFixed(2),
          [`Total Invoice Value (${baseCcy})`]: Number(r.totalAmount || 0).toFixed(2),
          "Invoices Count": r.invoiceCount || 0
        }));
        return sendCSV(res, reportName.replace(/\s+/g, '_'), csvData);
      }

      if (format === 'excel') {
        const workbook = XLSX.utils.book_new();

        // 1. Rate Summary Sheet
        const rateSheetData = (reportData.data || []).map(r => ({
          "Tax Rate (%)": `${r.taxRate}%`,
          [`Taxable Value (${baseCcy})`]: Number(r.taxableAmount || 0),
          [`CGST (${baseCcy})`]: Number(r.CGST || 0),
          [`SGST (${baseCcy})`]: Number(r.SGST || 0),
          [`IGST (${baseCcy})`]: Number(r.IGST || 0),
          [`Total GST (${baseCcy})`]: Number(r.totalTax || r.totalTaxBaseCcy || 0),
          [`Total Invoice Value (${baseCcy})`]: Number(r.totalAmount || 0),
          "Invoices Count": r.invoiceCount || 0
        }));
        const wsRate = XLSX.utils.json_to_sheet(rateSheetData);
        XLSX.utils.book_append_sheet(workbook, wsRate, "Rate Summary");

        // 2. Invoices (B2B & B2C) Sheet
        if (reportData.invoices && reportData.invoices.length > 0) {
          const invSheetData = reportData.invoices.map(inv => ({
            "Invoice #": inv.invoiceNumber,
            "Invoice Date": inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-',
            "Customer": inv.customerName,
            "GSTIN": inv.gstin,
            "Supply Type": inv.supplyType,
            "Place of Supply": inv.placeOfSupply,
            [`Taxable Value (${baseCcy})`]: Number(inv.taxableAmount || 0),
            "GST Rate (%)": `${inv.taxRate}%`,
            [`CGST (${baseCcy})`]: Number(inv.cgst || 0),
            [`SGST (${baseCcy})`]: Number(inv.sgst || 0),
            [`IGST (${baseCcy})`]: Number(inv.igst || 0),
            [`Total GST (${baseCcy})`]: Number(inv.totalTax || 0),
            [`Grand Total (${baseCcy})`]: Number(inv.totalAmount || 0),
            "Status": inv.status
          }));
          const wsInv = XLSX.utils.json_to_sheet(invSheetData);
          XLSX.utils.book_append_sheet(workbook, wsInv, "B2B & B2C Invoices");
        }

        // 3. HSN Summary Sheet
        if (reportData.hsnSummary && reportData.hsnSummary.length > 0) {
          const hsnSheetData = reportData.hsnSummary.map(h => ({
            "HSN/SAC Code": h.hsnCode,
            "Description": h.description,
            "UQC": h.uqc,
            "Total Quantity": h.totalQuantity,
            [`Taxable Value (${baseCcy})`]: Number(h.taxableAmount || 0),
            "Rate (%)": `${h.taxRate}%`,
            [`CGST (${baseCcy})`]: Number(h.cgst || 0),
            [`SGST (${baseCcy})`]: Number(h.sgst || 0),
            [`IGST (${baseCcy})`]: Number(h.igst || 0),
            [`Total Tax (${baseCcy})`]: Number(h.totalTax || 0)
          }));
          const wsHsn = XLSX.utils.json_to_sheet(hsnSheetData);
          XLSX.utils.book_append_sheet(workbook, wsHsn, "HSN Summary");
        }

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`);
        return res.send(buffer);
      }

      if (format === 'pdf') {
        const sum = reportData.summary || {};
        const kpis = [
          {
            label: 'TAXABLE TURNOVER',
            value: `${sym} ${(sum.totalTaxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Net outward supplies'
          },
          {
            label: 'TOTAL GST LIABILITY',
            value: `${sym} ${(sum.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Total output tax payable'
          },
          {
            label: 'CENTRAL & STATE GST',
            value: `${sym} ${((sum.totalCgst || 0) + (sum.totalSgst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: `CGST: ${sym}${(sum.totalCgst || 0).toFixed(2)} | SGST: ${sym}${(sum.totalSgst || 0).toFixed(2)}`
          },
          {
            label: 'INTEGRATED GST (IGST)',
            value: `${sym} ${(sum.totalIgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Inter-state supplies tax'
          }
        ];

        const headers = ['Tax Rate', `Taxable Value (${baseCcy})`, `CGST (${baseCcy})`, `SGST (${baseCcy})`, `IGST (${baseCcy})`, `Total GST (${baseCcy})`, `Total Value (${baseCcy})`];
        const widths = [75, 115, 105, 105, 105, 115, 120];

        const dataRows = (reportData.data || []).map(r => [
          `${r.taxRate}%`,
          Number(r.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(r.CGST || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(r.SGST || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(r.IGST || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(r.totalTax || r.totalTaxBaseCcy || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(r.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ]);

        const totalsRow = {
          'Tax Rate': 'Summary Totals',
          [`Taxable Value (${baseCcy})`]: `${sym} ${(sum.totalTaxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          [`CGST (${baseCcy})`]: `${sym} ${(sum.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          [`SGST (${baseCcy})`]: `${sym} ${(sum.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          [`IGST (${baseCcy})`]: `${sym} ${(sum.totalIgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          [`Total GST (${baseCcy})`]: `${sym} ${(sum.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          [`Total Value (${baseCcy})`]: `${sym} ${(sum.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        };

        return await buildPDF(res, reportName, headers, widths, dataRows, business.name, {
          subtitle: 'GSTR-1 Outward Supplies Return — Periodic Audit Ledger',
          business: business || { name: req.business.name },
          settings: settings || { companyName: req.business.name },
          period: periodLabel,
          kpis,
          totals: totalsRow,
          currencySymbol: sym,
          baseCurrency: baseCcy
        });
      }
    }

    // -------------------------------------------------------------
    // General Statutory Reports (GSTR-3B, VAT Returns, Generic)
    // -------------------------------------------------------------
    if (format === 'csv') {
      const rawHeaders = rows.length > 0 && typeof rows[0] === 'object' ? Object.keys(rows[0]) : [];
      const formattedRows = rows.map(r => {
        const item = {};
        rawHeaders.forEach(k => {
          item[formatHeader(k)] = r[k];
        });
        return item;
      });
      return sendCSV(res, reportName.replace(/\s+/g, '_'), formattedRows);
    }

    if (format === 'excel') {
      const rawHeaders = rows.length > 0 && typeof rows[0] === 'object' ? Object.keys(rows[0]) : [];
      const formattedRows = rows.map(r => {
        const item = {};
        rawHeaders.forEach(k => {
          item[formatHeader(k)] = r[k];
        });
        return item;
      });
      return sendExcel(res, reportName.replace(/\s+/g, '_'), 'Report', formattedRows);
    }

    if (format === 'pdf') {
      let rawHeaders = [];
      if (rows.length > 0 && typeof rows[0] === 'object') {
        rawHeaders = Object.keys(rows[0]);
      }
      
      const headers = rawHeaders.map(formatHeader);
      const widthPerCol = headers.length > 0 ? Math.floor(740 / headers.length) : 100;
      const widths = headers.map(() => widthPerCol);
      
      const dataRows = rows.map(r => {
        return rawHeaders.map(h => {
          const val = r[h];
          if (typeof val === 'number') {
            return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
          if (typeof val === 'object' && val !== null) {
            return JSON.stringify(val);
          }
          return val ?? '-';
        });
      });

      return await buildPDF(res, reportName, headers, widths, dataRows, business.name, {
        subtitle: `${reportName} — Periodic Statutory Return Audit`,
        business: business || { name: req.business.name },
        settings: settings || { companyName: req.business.name },
        period: periodLabel,
        currencySymbol: sym,
        baseCurrency: baseCcy
      });
    }

    res.status(400).json({ success: false, message: 'Invalid format' });
  } catch (error) {
    console.error("exportStatutoryReport error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
