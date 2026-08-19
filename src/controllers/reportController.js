const prisma = require("../config/prisma");

// NOTE: P&L and Balance Sheet still use synthetic aggregation from Invoices/Expenses/Payments,
// not JournalEntry. They may diverge from Trial Balance for periods with manual journal entries.

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
