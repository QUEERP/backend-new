const prisma = require("../config/prisma");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");

const buildPDF = (res, title, headers, colWidths, dataRows) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  doc.fontSize(20).text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1.5);
  
  if (dataRows.length === 0) {
    doc.fontSize(12).text("No data available.", { align: 'center' });
    doc.end();
    return;
  }

  const tableTop = doc.y;
  let currentX = 30;
  doc.font('Helvetica-Bold').fontSize(10);
  headers.forEach((h, i) => {
    doc.text(h, currentX, tableTop, { width: colWidths[i] });
    currentX += colWidths[i] + 10;
  });
  
  let currentY = tableTop + 20;
  doc.font('Helvetica').fontSize(9);
  
  dataRows.forEach(row => {
    if (currentY > 500) {
      doc.addPage();
      currentY = 30;
    }
    currentX = 30;
    row.forEach((text, i) => {
      doc.text(String(text || '-'), currentX, currentY, { width: colWidths[i] });
      currentX += colWidths[i] + 10;
    });
    currentY += 20;
  });

  doc.end();
};

const sendExcel = (res, filename, sheetName, data) => {
  if (data.length === 0) {
    data = [{ Message: "No data available" }];
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  res.send(buffer);
};

// ---------------------------------------------------------
// BALANCE SHEET
// ---------------------------------------------------------
const getBalanceSheetData = async (businessId) => {
    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId, isDeleted: false, status: { not: "CANCELLED" } }
    });
    const paymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { businessId }
    });
    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId }
    });

    const totalInvoices = invoiceAgg._sum.grandTotal || 0;
    const totalPaymentsReceived = paymentAgg._sum.amount || 0;
    const totalExpenses = expenseAgg._sum.amount || 0;

    const cashBalance = totalPaymentsReceived - totalExpenses;
    const accountsReceivable = totalInvoices - totalPaymentsReceived;
    const retainedEarnings = totalInvoices - totalExpenses;

    const assets = [
      { id: 'cash', name: 'Cash & Bank', balance: cashBalance },
      { id: 'ar', name: 'Accounts Receivable', balance: accountsReceivable > 0 ? accountsReceivable : 0 }
    ];

    const liabilities = [];
    if (accountsReceivable < 0) {
      liabilities.push({ id: 'advances', name: 'Customer Advances', balance: Math.abs(accountsReceivable) });
    }

    const equities = [
      { id: 'retained_earnings', name: 'Retained Earnings', balance: retainedEarnings }
    ];

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equities.reduce((sum, e) => sum + e.balance, 0);
    
    return { assets, liabilities, equities, totalAssets, totalLiabilities, totalEquity };
};

exports.exportBalanceSheetExcel = async (req, res) => {
  try {
    const data = await getBalanceSheetData(req.business.id);
    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const excelData = [];
    excelData.push({ Category: 'ASSETS', Account: '', Balance: '' });
    data.assets.forEach(a => excelData.push({ Category: '', Account: a.name, Balance: fmt(a.balance) }));
    excelData.push({ Category: '', Account: 'Total Assets', Balance: fmt(data.totalAssets) });
    excelData.push({ Category: '', Account: '', Balance: '' });
    
    excelData.push({ Category: 'LIABILITIES', Account: '', Balance: '' });
    data.liabilities.forEach(l => excelData.push({ Category: '', Account: l.name, Balance: fmt(l.balance) }));
    excelData.push({ Category: '', Account: 'Total Liabilities', Balance: fmt(data.totalLiabilities) });
    excelData.push({ Category: '', Account: '', Balance: '' });
    
    excelData.push({ Category: 'EQUITY', Account: '', Balance: '' });
    data.equities.forEach(e => excelData.push({ Category: '', Account: e.name, Balance: fmt(e.balance) }));
    excelData.push({ Category: '', Account: 'Total Equity', Balance: fmt(data.totalEquity) });

    sendExcel(res, "Balance_Sheet", "Balance Sheet", excelData);
  } catch (err) { res.status(500).send(err.message); }
};

exports.exportBalanceSheetPDF = async (req, res) => {
  try {
    const data = await getBalanceSheetData(req.business.id);
    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const headers = ['Category', 'Account', 'Balance'];
    const widths = [150, 300, 150];
    const rows = [];
    
    rows.push(['ASSETS', '', '']);
    data.assets.forEach(a => rows.push(['', a.name, fmt(a.balance)]));
    rows.push(['', 'Total Assets', fmt(data.totalAssets)]);
    rows.push(['', '', '']);
    
    rows.push(['LIABILITIES', '', '']);
    data.liabilities.forEach(l => rows.push(['', l.name, fmt(l.balance)]));
    rows.push(['', 'Total Liabilities', fmt(data.totalLiabilities)]);
    rows.push(['', '', '']);
    
    rows.push(['EQUITY', '', '']);
    data.equities.forEach(e => rows.push(['', e.name, fmt(e.balance)]));
    rows.push(['', 'Total Equity', fmt(data.totalEquity)]);

    res.setHeader('Content-Disposition', `attachment; filename=Balance_Sheet_${new Date().toISOString().split('T')[0]}.pdf`);
    buildPDF(res, 'Balance Sheet', headers, widths, rows);
  } catch (err) { res.status(500).send(err.message); }
};

// ---------------------------------------------------------
// TRIAL BALANCE
// ---------------------------------------------------------
const getTrialBalanceData = async (businessId) => {
    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId, isDeleted: false, status: { not: "CANCELLED" } }
    });
    const paymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { businessId }
    });
    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId }
    });

    const totalInvoices = invoiceAgg._sum.grandTotal || 0;
    const totalPaymentsReceived = paymentAgg._sum.amount || 0;
    const totalExpenses = expenseAgg._sum.amount || 0;

    const accounts = [
      { id: 'cash', name: 'Cash & Bank', type: 'ASSET', debit: totalPaymentsReceived, credit: totalExpenses },
      { id: 'ar', name: 'Accounts Receivable', type: 'ASSET', debit: totalInvoices, credit: totalPaymentsReceived },
      { id: 'revenue', name: 'Sales Revenue', type: 'INCOME', debit: 0, credit: totalInvoices },
      { id: 'expense', name: 'Operating Expenses', type: 'EXPENSE', debit: totalExpenses, credit: 0 }
    ];

    let totalDebit = 0;
    let totalCredit = 0;

    const result = accounts.map(a => {
      let netDebit = 0;
      let netCredit = 0;
      if (a.debit > a.credit) {
        netDebit = a.debit - a.credit;
        totalDebit += netDebit;
      } else {
        netCredit = a.credit - a.debit;
        totalCredit += netCredit;
      }
      return { ...a, netDebit, netCredit };
    }).filter(a => a.netDebit > 0 || a.netCredit > 0);
    
    return { accounts: result, totalDebit, totalCredit };
};

exports.exportTrialBalanceExcel = async (req, res) => {
  try {
    const data = await getTrialBalanceData(req.business.id);
    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const excelData = data.accounts.map(a => ({
      Account: a.name,
      Type: a.type,
      Debit: a.netDebit > 0 ? fmt(a.netDebit) : '-',
      Credit: a.netCredit > 0 ? fmt(a.netCredit) : '-'
    }));
    
    excelData.push({ Account: 'TOTAL', Type: '', Debit: fmt(data.totalDebit), Credit: fmt(data.totalCredit) });

    sendExcel(res, "Trial_Balance", "Trial Balance", excelData);
  } catch (err) { res.status(500).send(err.message); }
};

exports.exportTrialBalancePDF = async (req, res) => {
  try {
    const data = await getTrialBalanceData(req.business.id);
    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const headers = ['Account', 'Type', 'Debit', 'Credit'];
    const widths = [250, 150, 100, 100];
    const rows = data.accounts.map(a => [
      a.name,
      a.type,
      a.netDebit > 0 ? fmt(a.netDebit) : '-',
      a.netCredit > 0 ? fmt(a.netCredit) : '-'
    ]);
    rows.push(['TOTAL', '', fmt(data.totalDebit), fmt(data.totalCredit)]);

    res.setHeader('Content-Disposition', `attachment; filename=Trial_Balance_${new Date().toISOString().split('T')[0]}.pdf`);
    buildPDF(res, 'Trial Balance', headers, widths, rows);
  } catch (err) { res.status(500).send(err.message); }
};

// ---------------------------------------------------------
// GENERAL LEDGER
// ---------------------------------------------------------
const getGeneralLedgerData = async (businessId) => {
    const invoices = await prisma.invoice.findMany({
      where: { businessId, isDeleted: false, status: { not: "CANCELLED" } },
      select: { id: true, invoiceDate: true, invoiceNumber: true, grandTotal: true }
    });
    const payments = await prisma.payment.findMany({
      where: { businessId },
      select: { id: true, paymentDate: true, paymentNumber: true, amount: true }
    });
    const expenses = await prisma.expense.findMany({
      where: { businessId },
      select: { id: true, date: true, title: true, amount: true }
    });

    const entries = [];

    invoices.forEach(inv => {
      entries.push({ id: inv.id + '_ar', date: inv.invoiceDate, account: 'Accounts Receivable', description: `Invoice ${inv.invoiceNumber}`, debit: inv.grandTotal, credit: 0 });
      entries.push({ id: inv.id + '_rev', date: inv.invoiceDate, account: 'Sales Revenue', description: `Invoice ${inv.invoiceNumber}`, debit: 0, credit: inv.grandTotal });
    });

    payments.forEach(pay => {
      entries.push({ id: pay.id + '_cash', date: pay.paymentDate, account: 'Cash & Bank', description: `Payment ${pay.paymentNumber || pay.id.slice(-6)}`, debit: pay.amount, credit: 0 });
      entries.push({ id: pay.id + '_ar', date: pay.paymentDate, account: 'Accounts Receivable', description: `Payment ${pay.paymentNumber || pay.id.slice(-6)}`, debit: 0, credit: pay.amount });
    });

    expenses.forEach(exp => {
      entries.push({ id: exp.id + '_exp', date: exp.date, account: 'Operating Expenses', description: `Expense: ${exp.title}`, debit: exp.amount, credit: 0 });
      entries.push({ id: exp.id + '_cash', date: exp.date, account: 'Cash & Bank', description: `Expense Payment: ${exp.title}`, debit: 0, credit: exp.amount });
    });

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    return entries;
};

exports.exportGeneralLedgerExcel = async (req, res) => {
  try {
    const entries = await getGeneralLedgerData(req.business.id);
    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const excelData = entries.map(e => ({
      Date: new Date(e.date).toLocaleDateString(),
      Account: e.account,
      Description: e.description || '-',
      Debit: e.debit > 0 ? fmt(e.debit) : '-',
      Credit: e.credit > 0 ? fmt(e.credit) : '-'
    }));

    sendExcel(res, "General_Ledger", "General Ledger", excelData);
  } catch (err) { res.status(500).send(err.message); }
};

exports.exportGeneralLedgerPDF = async (req, res) => {
  try {
    const entries = await getGeneralLedgerData(req.business.id);
    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const headers = ['Date', 'Account', 'Description', 'Debit', 'Credit'];
    const widths = [80, 150, 220, 75, 75];
    const rows = entries.map(e => [
      new Date(e.date).toLocaleDateString(),
      e.account,
      e.description || '-',
      e.debit > 0 ? fmt(e.debit) : '-',
      e.credit > 0 ? fmt(e.credit) : '-'
    ]);

    res.setHeader('Content-Disposition', `attachment; filename=General_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    buildPDF(res, 'General Ledger', headers, widths, rows);
  } catch (err) { res.status(500).send(err.message); }
};

// ---------------------------------------------------------
// PROFIT & LOSS
// ---------------------------------------------------------
exports.exportProfitLossExcel = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const invoiceDateFilter = {};
    const expenseDateFilter = {};
    if (fromDate || toDate) {
      if (fromDate) { invoiceDateFilter.gte = new Date(fromDate); expenseDateFilter.gte = new Date(fromDate); }
      if (toDate) { invoiceDateFilter.lte = new Date(toDate); expenseDateFilter.lte = new Date(toDate); }
    }

    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId: req.business.id, isDeleted: false, status: { not: "CANCELLED" }, ...(fromDate || toDate ? { invoiceDate: invoiceDateFilter } : {}) }
    });

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id, ...(fromDate || toDate ? { date: expenseDateFilter } : {}) }
    });

    let income = invoiceAgg._sum.grandTotal || 0;
    let expense = expenseAgg._sum.amount || 0;
    const profit = income - expense;
    const status = profit >= 0 ? "PROFIT" : "LOSS";

    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const excelData = [
      { Metric: 'Total Income', Amount: fmt(income) },
      { Metric: 'Total Expenses', Amount: fmt(expense) },
      { Metric: `Net ${status === 'PROFIT' ? 'Profit' : 'Loss'}`, Amount: fmt(Math.abs(profit)) }
    ];

    sendExcel(res, "Profit_Loss", "Profit & Loss", excelData);
  } catch (err) { res.status(500).send(err.message); }
};

exports.exportProfitLossPDF = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const invoiceDateFilter = {};
    const expenseDateFilter = {};
    if (fromDate || toDate) {
      if (fromDate) { invoiceDateFilter.gte = new Date(fromDate); expenseDateFilter.gte = new Date(fromDate); }
      if (toDate) { invoiceDateFilter.lte = new Date(toDate); expenseDateFilter.lte = new Date(toDate); }
    }

    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId: req.business.id, isDeleted: false, status: { not: "CANCELLED" }, ...(fromDate || toDate ? { invoiceDate: invoiceDateFilter } : {}) }
    });

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id, ...(fromDate || toDate ? { date: expenseDateFilter } : {}) }
    });

    let income = invoiceAgg._sum.grandTotal || 0;
    let expense = expenseAgg._sum.amount || 0;
    const profit = income - expense;
    const status = profit >= 0 ? "PROFIT" : "LOSS";

    const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const headers = ['Metric', 'Amount'];
    const widths = [300, 300];
    const rows = [
      ['Total Income', fmt(income)],
      ['Total Expenses', fmt(expense)],
      [`Net ${status === 'PROFIT' ? 'Profit' : 'Loss'}`, fmt(Math.abs(profit))]
    ];

    res.setHeader('Content-Disposition', `attachment; filename=Profit_Loss_${new Date().toISOString().split('T')[0]}.pdf`);
    buildPDF(res, 'Profit & Loss Statement', headers, widths, rows);
  } catch (err) { res.status(500).send(err.message); }
};
