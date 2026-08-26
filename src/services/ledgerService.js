/**
 * Centralized Double-Entry Ledger Posting Engine
 */

const getSystemAccounts = async (tx, businessId) => {
  const accountTypes = [
    { code: 'SYSTEM_CASH', name: 'Cash & Bank', type: 'ASSET' },
    { code: 'SYSTEM_AR', name: 'Accounts Receivable', type: 'ASSET' },
    { code: 'SYSTEM_AP', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: 'SYSTEM_REVENUE', name: 'Sales Revenue', type: 'INCOME' },
    { code: 'SYSTEM_COGS', name: 'Cost of Goods Sold', type: 'EXPENSE' },
    { code: 'SYSTEM_SALES_RETURN', name: 'Sales Returns', type: 'INCOME' },
    { code: 'SYSTEM_INVENTORY', name: 'Inventory Asset', type: 'ASSET' },
    { code: 'SYSTEM_CUSTOMER_ADVANCE', name: 'Customer Advances', type: 'LIABILITY' },
    { code: 'SYSTEM_EMPLOYEE_LOAN', name: 'Employee Loans Receivable', type: 'ASSET' },
    { code: 'SYSTEM_PURCHASE_RETURN', name: 'Purchase Returns', type: 'EXPENSE' },
    { code: 'SYSTEM_SALARY_EXPENSE', name: 'Salary & Wages', type: 'EXPENSE' },
    { code: 'SYSTEM_STOCK_ADJUSTMENT', name: 'Stock Adjustments', type: 'EXPENSE' },
    { code: 'SYSTEM_TAX_PAYABLE', name: 'Tax Payable', type: 'LIABILITY' },
    { code: 'SYSTEM_TAX_RECEIVABLE', name: 'Tax Receivable', type: 'ASSET' },
    { code: 'SYSTEM_FX_GAIN_LOSS', name: 'Realized FX Gain/Loss', type: 'EXPENSE' }
  ];

  const accounts = {};

  for (const acc of accountTypes) {
    let dbAccount = await tx.account.findFirst({
      where: { businessId, code: acc.code }
    });

    if (!dbAccount) {
      dbAccount = await tx.account.create({
        data: {
          businessId,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          isActive: true
        }
      });
    }
    accounts[acc.code] = dbAccount.id;
  }

  return accounts;
};

const getDynamicExpenseAccount = async (tx, businessId, categoryName) => {
  let dbAccount = await tx.account.findFirst({
    where: { businessId, name: categoryName, type: 'EXPENSE' }
  });

  if (!dbAccount) {
    dbAccount = await tx.account.create({
      data: {
        businessId,
        name: categoryName,
        type: 'EXPENSE',
        isActive: true
      }
    });
  }
  return dbAccount.id;
};

const postJournalEntries = async (tx, entries) => {
  if (!entries || entries.length === 0) return;

  const processedEntries = entries.map(e => {
    const rate = Number(e.exchangeRate) || 1.0;
    return {
      ...e,
      baseDebit: e.baseDebit !== undefined ? e.baseDebit : (e.debit || 0) * rate,
      baseCredit: e.baseCredit !== undefined ? e.baseCredit : (e.credit || 0) * rate
    };
  });

  // 1. Validate that the entries balance (Debits === Credits)
  const totalDebit = processedEntries.reduce((sum, e) => sum + e.baseDebit, 0);
  const totalCredit = processedEntries.reduce((sum, e) => sum + e.baseCredit, 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Ledger posting failed: Journal entries do not balance. Debit: ${totalDebit}, Credit: ${totalCredit}`);
  }

  // 2. Post entries
  await tx.journalEntry.createMany({
    data: processedEntries.map(e => ({
      businessId: e.businessId,
      accountId: e.accountId,
      debit: e.debit || 0,
      credit: e.credit || 0,
      baseDebit: e.baseDebit,
      baseCredit: e.baseCredit,
      description: e.description,
      date: e.date || new Date(),
      currency: e.currency || "AED",
      exchangeRate: Number(e.exchangeRate) || 1.0
    }))
  });
};

module.exports = {
  getSystemAccounts,
  getDynamicExpenseAccount,
  postJournalEntries
};
