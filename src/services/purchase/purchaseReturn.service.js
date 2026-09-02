const prisma = require("../../config/prisma");
const { logAction } = require("../sales/audit.service");
const { generateDocNumber } = require("../sales/quotation.service");
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

const createPurchaseReturn = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // Generate Return Number
    const returnNumber = await generateDocNumber(tx, businessId, "PRT", "purchaseReturn", "returnNumber");

    const returnDate = new Date();
    let overrideCurrencyData = undefined;
    let currencyCode = "AED"; // fallback

    // If linked to a Bill, extract historical rate
    if (data.billId) {
      const originalBill = await tx.bill.findFirst({
        where: { id: data.billId, businessId }
      });
      if (originalBill && originalBill.transactionCurrencyId) {
        const txnCur = await tx.currency.findUnique({ where: { id: originalBill.transactionCurrencyId } });
        if (txnCur) {
          currencyCode = txnCur.code;
          overrideCurrencyData = {
            transactionCurrencyId: originalBill.transactionCurrencyId,
            baseCurrencyId: originalBill.baseCurrencyId,
            exchangeRate: originalBill.exchangeRate,
            statutoryRate: originalBill.statutoryExchangeRate,
            decimals: txnCur.decimals || 2
          };
        }
      }
    }

    const discount = data.discount ? parseFloat(data.discount) : 0;

    // Process financials, forcing historical rate if applicable
    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate: returnDate,
      currencyCode: data.currency || currencyCode,
      items: data.items || [],
      customerId: null,
      globalDiscount: discount,
      txClient: tx,
      overrideCurrencyData,
      userId
    });

    const grandTotal = financials.subtotal + financials.totalTax - discount;

    const itemsData = data.items.map(item => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.price);
      const itemSubtotal = qty * price;
      const taxAmt = item.taxPercent ? itemSubtotal * (parseFloat(item.taxPercent) / 100) : 0;

      return {
        productId: item.productId,
        description: item.description || "",
        quantity: qty,
        price,
        
        total: itemSubtotal + taxAmt,
        warehouseId: item.warehouseId || data.warehouseId || null,
        isStockReturned: item.isStockReturned !== undefined ? item.isStockReturned : true
      };
    });

    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        businessId,
        returnNumber,
        vendorId: data.vendorId,
        billId: data.billId || null,
        grnId: data.grnId || null,
        status: "PENDING",
        reason: data.reason || null,
        refundStatus: "PENDING",
        subtotal: financials.subtotal,
        tax: financials.totalTax,
        totalAmount: grandTotal,
        currency: data.currency || currencyCode,

        // Currency engine fields
        transactionCurrencyId: financials.currencyData.transactionCurrencyId,
        baseCurrencyId: financials.currencyData.baseCurrencyId,
        exchangeRate: financials.currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
        items: {
          create: itemsData
        }
      },
      include: {
        items: true,
        vendor: true
      }
    });

    await TransactionHelper.saveTaxLedger(tx, businessId, "PURCHASE_RETURN", purchaseReturn.id, financials.taxTransactions, true);

    // Process inventory and vendor balance impacts
    for (const item of itemsData) {
      if (item.isStockReturned && item.warehouseId) {
        // Deduct from warehouse stock via RETURN_OUT movement
        await createStockMovement(tx, {
          businessId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: -item.quantity,
          type: "RETURN_OUT",
          referenceType: "PURCHASE_RETURN",
          referenceId: purchaseReturn.id,
          performedBy: userEmail,
          notes: `Stock returned to vendor: ${returnNumber}`
        });
      }
    }

    // Reduce vendor liability balance (refund)
    await tx.vendor.update({
      where: { id: data.vendorId },
      data: {
        balance: {
          decrement: grandTotal
        }
      }
    });

    // POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    const returnRate = financials.currencyData.exchangeRate;
    const decimals = financials.currencyData.decimals;
    const tax = financials.totalTax;

    const grandTotalBaseCcy = CurrencyService.scaleAmount(grandTotal, returnRate, decimals);

    let goodsTotal = 0;
    let servicesTotal = 0;

    for (const item of itemsData) {
      if (item.isStockReturned) {
        goodsTotal += (item.total || 0);
      } else {
        servicesTotal += (item.total || 0);
      }
    }

    const subtotalCalc = goodsTotal + servicesTotal;
    const goodsRatio = subtotalCalc > 0 ? goodsTotal / subtotalCalc : 0;
    const servicesRatio = subtotalCalc > 0 ? servicesTotal / subtotalCalc : 0;

    const costBasisTxn = grandTotal; // Total amount to reverse
    let allocatedGoodsTxn = 0;
    let allocatedServicesTxn = 0;

    if (goodsRatio > 0) allocatedGoodsTxn = costBasisTxn * goodsRatio;
    if (servicesRatio > 0) allocatedServicesTxn = costBasisTxn * servicesRatio;

    // Scale accurately for base
    const taxAmountBaseCcy = CurrencyService.scaleAmount(tax, returnRate, decimals);
    const goodsAmountBaseCcy = CurrencyService.scaleAmount(allocatedGoodsTxn, returnRate, decimals);
    
    // Plug technique to perfectly match AP debit
    const servicesAmountBaseCcy = Number((grandTotalBaseCcy - taxAmountBaseCcy - goodsAmountBaseCcy).toFixed(decimals));

    const journalEntries = [
      // Debit AP to reduce liability (Reversal of Bill)
      { businessId, accountId: accounts.SYSTEM_AP, debit: grandTotal, credit: 0, baseDebit: grandTotalBaseCcy, baseCredit: 0, description: `Purchase Return ${returnNumber}`, exchangeRate: returnRate }
    ];

    if (goodsAmountBaseCcy > 0) {
      journalEntries.push({ businessId, accountId: accounts.SYSTEM_INVENTORY, debit: 0, credit: allocatedGoodsTxn, baseDebit: 0, baseCredit: goodsAmountBaseCcy, description: `Purchase Return ${returnNumber} (Goods)`, exchangeRate: returnRate });
    }

    if (servicesAmountBaseCcy > 0) {
      const expenseAccountId = await getDynamicExpenseAccount(tx, businessId, "General Expense");
      journalEntries.push({ businessId, accountId: expenseAccountId, debit: 0, credit: allocatedServicesTxn, baseDebit: 0, baseCredit: servicesAmountBaseCcy, description: `Purchase Return ${returnNumber} (Services)`, exchangeRate: returnRate });
    }

    // Notice we skipped tax reversal in the base allocations if we push it separately?
    // Wait, the legacy code: `allocatedGoodsAmount = goodsTotal + (taxVal * goodsRatio) - ...` means tax was fully rolled into the Inventory/Expense credit.
    // If we want to correctly reverse recoverable tax, we should do it identically to Bill.
    // Let's do it like Bill:
    // Reversal of Recoverable Tax
    let isRecoverable = true;
    if (data.taxRuleId) {
      const taxRule = await tx.taxRule.findUnique({ where: { id: data.taxRuleId } });
      if (taxRule) isRecoverable = taxRule.isRecoverable;
    } else if (data.hasOwnProperty('isRecoverable')) {
      isRecoverable = data.isRecoverable === 'true' || data.isRecoverable === true;
    }

    let nonRecoverableTax = 0;
    if (tax > 0 && !isRecoverable) {
      nonRecoverableTax = tax;
    }

    const preciseCostBasisTxn = financials.subtotal - discount + nonRecoverableTax;
    
    let preciseAllocatedGoodsTxn = 0;
    let preciseAllocatedServicesTxn = 0;
    if (goodsRatio > 0) preciseAllocatedGoodsTxn = preciseCostBasisTxn * goodsRatio;
    if (servicesRatio > 0) preciseAllocatedServicesTxn = preciseCostBasisTxn * servicesRatio;

    let preciseTaxAmountBaseCcy = isRecoverable ? CurrencyService.scaleAmount(tax, returnRate, decimals) : 0;
    let preciseGoodsAmountBaseCcy = CurrencyService.scaleAmount(preciseAllocatedGoodsTxn, returnRate, decimals);
    let preciseServicesAmountBaseCcy = CurrencyService.scaleAmount(preciseAllocatedServicesTxn, returnRate, decimals);

    const baseSum = preciseTaxAmountBaseCcy + preciseGoodsAmountBaseCcy + preciseServicesAmountBaseCcy;
    const difference = Number((grandTotalBaseCcy - baseSum).toFixed(decimals));

    if (difference !== 0) {
      if (preciseAllocatedGoodsTxn >= preciseAllocatedServicesTxn && preciseAllocatedGoodsTxn > 0) {
        preciseGoodsAmountBaseCcy = Number((preciseGoodsAmountBaseCcy + difference).toFixed(decimals));
      } else if (preciseAllocatedServicesTxn > 0) {
        preciseServicesAmountBaseCcy = Number((preciseServicesAmountBaseCcy + difference).toFixed(decimals));
      } else if (isRecoverable && tax > 0) {
        preciseTaxAmountBaseCcy = Number((preciseTaxAmountBaseCcy + difference).toFixed(decimals));
      }
    }

    const finalJournalEntries = [
      { businessId, accountId: accounts.SYSTEM_AP, debit: grandTotal, credit: 0, baseDebit: grandTotalBaseCcy, baseCredit: 0, description: `Purchase Return ${returnNumber}`, exchangeRate: returnRate }
    ];

    if (isRecoverable && preciseTaxAmountBaseCcy > 0) {
      // Reversing Tax Receivable means Crediting it
      finalJournalEntries.push({ businessId, accountId: accounts.SYSTEM_TAX_RECEIVABLE, debit: 0, credit: tax, baseDebit: 0, baseCredit: preciseTaxAmountBaseCcy, description: `Purchase Return ${returnNumber} (Tax Reversal)`, exchangeRate: returnRate });
    }

    if (preciseGoodsAmountBaseCcy > 0) {
      finalJournalEntries.push({ businessId, accountId: accounts.SYSTEM_INVENTORY, debit: 0, credit: preciseAllocatedGoodsTxn, baseDebit: 0, baseCredit: preciseGoodsAmountBaseCcy, description: `Purchase Return ${returnNumber} (Goods Reversal)`, exchangeRate: returnRate });
    }

    if (preciseServicesAmountBaseCcy > 0) {
      const expenseAccountId = await getDynamicExpenseAccount(tx, businessId, "General Expense");
      finalJournalEntries.push({ businessId, accountId: expenseAccountId, debit: 0, credit: preciseAllocatedServicesTxn, baseDebit: 0, baseCredit: preciseServicesAmountBaseCcy, description: `Purchase Return ${returnNumber} (Services Reversal)`, exchangeRate: returnRate });
    }

    await postJournalEntries(tx, finalJournalEntries);

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PURCHASE_RETURN_CREATED",
      module: "PURCHASE",
      entityType: "PurchaseReturn",
      entityId: purchaseReturn.id,
      details: { returnNumber, totalAmount: grandTotal }
    });

    return purchaseReturn;
  }, { maxWait: 5000, timeout: 30000 });
};

const getPurchaseReturns = async (businessId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = { businessId };

  if (query.status) {
    where.status = query.status;
  }
  if (query.vendorId) {
    where.vendorId = query.vendorId;
  }
  if (query.search) {
    where.returnNumber = { contains: query.search, mode: "insensitive" };
  }

  const [returns, total] = await Promise.all([
    prisma.purchaseReturn.findMany({
      where,
      skip,
      take: limit,
      include: {
        vendor: { select: { id: true, name: true, companyName: true } },
        bill: { select: { id: true, billNumber: true } },
        grn: { select: { id: true, grnNumber: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.purchaseReturn.count({ where })
  ]);

  return {
    returns,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

const getPurchaseReturnById = async (businessId, id) => {
  const purchaseReturn = await prisma.purchaseReturn.findFirst({
    where: { id, businessId },
    include: {
      vendor: true,
      bill: true,
      grn: true,
      items: {
        include: {
          product: true,
          warehouse: true
        }
      }
    }
  });

  if (!purchaseReturn) throw new Error("Purchase Return not found");
  return purchaseReturn;
};

module.exports = {
  createPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnById
};
