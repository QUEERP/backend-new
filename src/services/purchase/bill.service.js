const prisma = require("../../config/prisma");
const { logAction } = require("../sales/audit.service");
const { createStockMovement } = require("../inventory/movement.service");
const { getSystemAccounts, getDynamicExpenseAccount, postJournalEntries } = require("../ledgerService");
const TransactionHelper = require("../TransactionHelper");
const { CurrencyService } = require("../currencyService");

const getPagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const createBill = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // Check if vendor exists
    const vendor = await tx.vendor.findFirst({
      where: { id: data.vendorId, businessId }
    });
    if (!vendor) throw new Error("Vendor not found");

    // Check if billNumber is unique for this vendor/business
    const existing = await tx.bill.findFirst({
      where: { billNumber: data.billNumber, businessId }
    });
    if (existing) {
      throw new Error(`Bill number "${data.billNumber}" already exists.`);
    }

    const transactionDate = data.billDate ? new Date(data.billDate) : new Date();
    const discount = data.discount ? parseFloat(data.discount) : 0;

    let subtotal = 0;
    let goodsTotal = 0;
    let servicesTotal = 0;

    // Use Engine for pricing, tax, and multi-currency
    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate,
      currencyCode: data.currency || "AED",
      items: data.items || [],
      customerId: null, // Bill doesn't use customer state
      vendorId: vendor.id,
      transactionType: 'BILL',
      globalDiscount: discount,
      userId,
      txClient: tx
    });

    const itemsData = await Promise.all(data.items.map(async (item) => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.price);
      const total = qty * price;
      subtotal += total;

      let isGoods = false;
      let itemType = "SERVICES";
      let product = null;
      if (item.productId) {
        product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product && product.type === "GOODS") {
          isGoods = true;
          itemType = "GOODS";
        }
      }

      if (isGoods) {
        goodsTotal += total;
      } else {
        servicesTotal += total;
      }

      return {
        productId: item.productId || null,
        warehouseId: item.warehouseId || null,
        name: item.name || (product ? product.name : "Unknown Item"),
        quantity: qty,
        price,
        total
      };
    }));

    const grandTotal = financials.subtotal + financials.totalTax - discount;

    const bill = await tx.bill.create({
      data: {
        businessId,
        billNumber: data.billNumber,
        status: "UNPAID",
        vendorId: data.vendorId,
        purchaseOrderId: data.purchaseOrderId || null,
        grnId: data.grnId || null,
        subtotal: financials.subtotal,
        tax: financials.totalTax,
        discount: discount,
        totalAmount: grandTotal,
        outstandingAmount: grandTotal,
        currency: data.currency || "AED",

        // Currency engine fields
        transactionCurrencyId: financials.currencyData.transactionCurrencyId,
        baseCurrencyId: financials.currencyData.baseCurrencyId,
        exchangeRate: financials.currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
        statutoryExchangeRate: financials.currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),

        billDate: transactionDate,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes || null,
        items: {
          create: itemsData
        }
      },
      include: {
        items: true
      }
    });

    // Handle Automatic Stock Increase based on Bill Items
    for (const item of itemsData) {
      if (item.productId && item.warehouseId) {
        await createStockMovement(tx, {
          businessId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          type: "PURCHASE",
          referenceType: "Bill",
          referenceId: bill.id,
          notes: `Stock entry from Bill ${bill.billNumber}`,
          performedBy: userEmail
        });
      }
    }

    // Increment Vendor liability balance
    await tx.vendor.update({
      where: { id: data.vendorId },
      data: {
        balance: {
          increment: grandTotal
        }
      }
    });

    // POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    
    // Save Tax Ledger (statutory requirement)
    await TransactionHelper.saveTaxLedger(tx, businessId, "BILL", bill.id, financials.taxTransactions);

    // Determine if tax is recoverable
    let isRecoverable = true;
    if (data.taxRuleId) {
      const taxRule = await tx.taxRule.findUnique({ where: { id: data.taxRuleId } });
      if (taxRule) {
        isRecoverable = taxRule.isRecoverable;
      }
    } else if (data.hasOwnProperty('isRecoverable')) {
      isRecoverable = data.isRecoverable === 'true' || data.isRecoverable === true;
    }

    const billRate = financials.currencyData.exchangeRate;
    const decimals = financials.currencyData.decimals;
    const tax = financials.totalTax;
    
    // Base amounts scaled directly and independently to guarantee consistency
    const grandTotalBaseCcy = CurrencyService.scaleAmount(grandTotal, billRate, decimals);
    
    // Determine the precise base currency legs based on proportions
    // Cost basis in txn currency
    let nonRecoverableTax = 0;
    if (tax > 0 && !isRecoverable) {
      nonRecoverableTax = tax;
    }
    
    const costBasisTxn = financials.subtotal - discount + nonRecoverableTax;
    const goodsRatio = financials.subtotal > 0 ? goodsTotal / financials.subtotal : 0;
    const servicesRatio = financials.subtotal > 0 ? servicesTotal / financials.subtotal : 0;

    let allocatedGoodsTxn = 0;
    let allocatedServicesTxn = 0;
    
    if (goodsRatio > 0) allocatedGoodsTxn = costBasisTxn * goodsRatio;
    if (servicesRatio > 0) allocatedServicesTxn = costBasisTxn * servicesRatio;

    // Scale precisely
    let taxAmountBaseCcy = isRecoverable ? CurrencyService.scaleAmount(tax, billRate, decimals) : 0;
    let goodsAmountBaseCcy = CurrencyService.scaleAmount(allocatedGoodsTxn, billRate, decimals);
    let servicesAmountBaseCcy = CurrencyService.scaleAmount(allocatedServicesTxn, billRate, decimals);
    
    // PLUG technique: find the difference and apply it to the largest non-zero leg
    const baseSum = taxAmountBaseCcy + goodsAmountBaseCcy + servicesAmountBaseCcy;
    const difference = Number((grandTotalBaseCcy - baseSum).toFixed(decimals));

    if (difference !== 0) {
      if (allocatedGoodsTxn >= allocatedServicesTxn && allocatedGoodsTxn > 0) {
        goodsAmountBaseCcy = Number((goodsAmountBaseCcy + difference).toFixed(decimals));
      } else if (allocatedServicesTxn > 0) {
        servicesAmountBaseCcy = Number((servicesAmountBaseCcy + difference).toFixed(decimals));
      } else if (isRecoverable && tax > 0) {
        taxAmountBaseCcy = Number((taxAmountBaseCcy + difference).toFixed(decimals));
      }
    }

    const journalEntries = [
      // Credit: Accounts Payable (Full Bill Amount)
      { businessId, accountId: accounts.SYSTEM_AP, debit: 0, credit: grandTotal, baseDebit: 0, baseCredit: grandTotalBaseCcy, description: `Vendor Bill ${bill.billNumber}`, exchangeRate: billRate }
    ];

    if (isRecoverable && taxAmountBaseCcy > 0) {
      journalEntries.push({ businessId, accountId: accounts.SYSTEM_TAX_RECEIVABLE, debit: tax, credit: 0, baseDebit: taxAmountBaseCcy, baseCredit: 0, description: `Recoverable Tax on Bill ${bill.billNumber}`, exchangeRate: billRate });
    }

    if (goodsAmountBaseCcy > 0) {
      journalEntries.push({ businessId, accountId: accounts.SYSTEM_INVENTORY, debit: allocatedGoodsTxn, credit: 0, baseDebit: goodsAmountBaseCcy, baseCredit: 0, description: `Inventory from Bill ${bill.billNumber}`, exchangeRate: billRate });
    }

    if (servicesAmountBaseCcy > 0) {
      const expenseAccountId = await getDynamicExpenseAccount(tx, businessId, "General Expense");
      journalEntries.push({ businessId, accountId: expenseAccountId, debit: allocatedServicesTxn, credit: 0, baseDebit: servicesAmountBaseCcy, baseCredit: 0, description: `Service Expense from Bill ${bill.billNumber}`, exchangeRate: billRate });
    }

    await postJournalEntries(tx, journalEntries);

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "BILL_CREATED",
      module: "PURCHASE",
      entityType: "Bill",
      entityId: bill.id,
      details: { billNumber: bill.billNumber, totalAmount: grandTotal }
    });

    return bill;
  }, { maxWait: 5000, timeout: 30000 });
};

const getBills = async (businessId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = { businessId };

  if (query.status) {
    where.status = query.status;
  }
  if (query.vendorId) {
    where.vendorId = query.vendorId;
  }
  if (query.search) {
    where.billNumber = { contains: query.search, mode: "insensitive" };
  }

  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";
  const orderBy = { [sortBy]: sortOrder };

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      skip,
      take: limit,
      include: {
        vendor: { select: { id: true, name: true, companyName: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        grn: { select: { id: true, grnNumber: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        }
      },
      orderBy
    }),
    prisma.bill.count({ where })
  ]);

  return {
    bills,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

const getBillById = async (businessId, id) => {
  const bill = await prisma.bill.findFirst({
    where: { id, businessId },
    include: {
      vendor: true,
      purchaseOrder: true,
      grn: true,
      items: {
        include: {
          product: true
        }
      },
      payments: true
    }
  });

  if (!bill) throw new Error("Bill not found");
  return bill;
};

module.exports = {
  createBill,
  getBills,
  getBillById
};
