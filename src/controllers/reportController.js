const prisma = require("../config/prisma");

//////////////////////////////////////////////////////
// PROFIT & LOSS (SYNTHETIC LEDGER)
//////////////////////////////////////////////////////
exports.getProfitLoss = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const invoiceDateFilter = {};
    const expenseDateFilter = {};
    
    if (fromDate || toDate) {
      if (fromDate) {
        invoiceDateFilter.gte = new Date(fromDate);
        expenseDateFilter.gte = new Date(fromDate);
      }
      if (toDate) {
        invoiceDateFilter.lte = new Date(toDate);
        expenseDateFilter.lte = new Date(toDate);
      }
    }

    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: {
        businessId: req.business.id,
        isDeleted: false,
        status: { not: "CANCELLED" },
        ...(fromDate || toDate ? { invoiceDate: invoiceDateFilter } : {})
      }
    });

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        businessId: req.business.id,
        ...(fromDate || toDate ? { date: expenseDateFilter } : {})
      }
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

    const paymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id, ...paymentDateFilter }
    });

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id, ...expenseDateFilter }
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

    res.json({
      success: true,
      assets,
      liabilities,
      equities,
      totalAssets,
      totalLiabilities,
      totalEquity,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// TRIAL BALANCE (SYNTHETIC LEDGER)
//////////////////////////////////////////////////////
exports.getTrialBalance = async (req, res) => {
  try {
    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId: req.business.id, isDeleted: false, status: { not: "CANCELLED" } }
    });
    const paymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id }
    });
    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId: req.business.id }
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

    res.json({
      success: true,
      accounts: result,
      totalDebit,
      totalCredit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// GENERAL LEDGER (SYNTHETIC LEDGER)
//////////////////////////////////////////////////////
exports.getGeneralLedger = async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { businessId: req.business.id, isDeleted: false, status: { not: "CANCELLED" } },
      select: { id: true, invoiceDate: true, invoiceNumber: true, grandTotal: true }
    });
    const payments = await prisma.payment.findMany({
      where: { businessId: req.business.id },
      select: { id: true, paymentDate: true, paymentNumber: true, amount: true }
    });
    const expenses = await prisma.expense.findMany({
      where: { businessId: req.business.id },
      select: { id: true, date: true, title: true, amount: true }
    });

    const entries = [];

    invoices.forEach(inv => {
      entries.push({
        id: inv.id + '_ar',
        date: inv.invoiceDate,
        account: { name: 'Accounts Receivable' },
        description: `Invoice ${inv.invoiceNumber}`,
        debit: inv.grandTotal,
        credit: 0
      });
      entries.push({
        id: inv.id + '_rev',
        date: inv.invoiceDate,
        account: { name: 'Sales Revenue' },
        description: `Invoice ${inv.invoiceNumber}`,
        debit: 0,
        credit: inv.grandTotal
      });
    });

    payments.forEach(pay => {
      entries.push({
        id: pay.id + '_cash',
        date: pay.paymentDate,
        account: { name: 'Cash & Bank' },
        description: `Payment ${pay.paymentNumber || pay.id.slice(-6)}`,
        debit: pay.amount,
        credit: 0
      });
      entries.push({
        id: pay.id + '_ar',
        date: pay.paymentDate,
        account: { name: 'Accounts Receivable' },
        description: `Payment ${pay.paymentNumber || pay.id.slice(-6)}`,
        debit: 0,
        credit: pay.amount
      });
    });

    expenses.forEach(exp => {
      entries.push({
        id: exp.id + '_exp',
        date: exp.date,
        account: { name: 'Operating Expenses' },
        description: `Expense: ${exp.title}`,
        debit: exp.amount,
        credit: 0
      });
      entries.push({
        id: exp.id + '_cash',
        date: exp.date,
        account: { name: 'Cash & Bank' },
        description: `Expense Payment: ${exp.title}`,
        debit: 0,
        credit: exp.amount
      });
    });

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      entries
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