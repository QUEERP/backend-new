const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("./audit.service");
const { getSystemAccounts, postJournalEntries } = require("../ledgerService");
const { generateDocNumber, calculatePricing } = require("./quotation.service");
const { releaseStock } = require("./salesOrder.service");
const { createStockMovement } = require("../inventory/movement.service");
const TransactionHelper = require("../TransactionHelper");
const { CurrencyService } = require("../currencyService");

/**
 * Deducts stock from physical inventory upon dispatch (invoice creation)
 * Returns the total COGS and Gross Profit for the invoice.
 */
const deductStock = async (tx, businessId, items, isFromReservation = false) => {
  let totalCogs = 0;
  let totalGrossProfit = 0;
  for (const item of items) {
    if (!item.productId) continue;

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { type: true }
    });

    if (product?.type === 'SERVICE') continue;

    const stockRecord = await tx.stock.findFirst({
      where: {
        productId: item.productId,
        warehouse: { businessId }
      }
    });

    if (stockRecord) {
      const reservedQtyDelta = isFromReservation ? -Math.min(stockRecord.reservedQty, item.quantity) : 0;
      const movement = await createStockMovement(tx, {
        businessId,
        productId: item.productId,
        warehouseId: stockRecord.warehouseId,
        quantity: -item.quantity,
        type: "SALE_OUT",
        referenceType: "INVOICE",
        referenceId: item.invoiceId || null,
        notes: "Auto-deducted upon sales invoice creation",
        reservedQtyDelta
      });

      if (item.id) {
        const cogsAmount = movement.cogsAmount || 0;
        const grossProfit = (item.totalAmount || item.amount || 0) - cogsAmount;
        const grossMarginPercent = (item.totalAmount || item.amount) > 0 ? (grossProfit / (item.totalAmount || item.amount)) * 100 : 0;
        
        await tx.invoiceItem.update({
          where: { id: item.id },
          data: {
             cogsAmount: cogsAmount,
             unitCost: movement.unitCost,
             valuationMethodUsed: movement.valuationMethodUsed,
             grossProfit: grossProfit,
             grossMarginPercent: grossMarginPercent
          }
        });

        totalCogs += cogsAmount;
        totalGrossProfit += grossProfit;
      }
    }
  }

  return { totalCogs, totalGrossProfit };
};

/**
 * Restores dispatched stock back to inventory (invoice cancel/deletion)
 */
const restoreStock = async (tx, businessId, items) => {
  for (const item of items) {
    if (!item.productId) continue;

    const stockRecord = await tx.stock.findFirst({
      where: {
        productId: item.productId,
        warehouse: { businessId }
      }
    });

    if (stockRecord) {
      await createStockMovement(tx, {
        businessId,
        productId: item.productId,
        warehouseId: stockRecord.warehouseId,
        quantity: item.quantity,
        type: "RETURN_IN",
        referenceType: "INVOICE",
        referenceId: item.invoiceId || null,
        notes: "Restored upon invoice cancellation/deletion",
        unitCost: item.unitCost || 0 // Restore at the same cost it was deducted if possible
      });
    }
  }
};

const createInvoice = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Generate unique invoice number
    const invoiceNumber = await generateDocNumber(tx, businessId, "INV", "invoice", "invoiceNumber");

    // 2. Compute pricing via TransactionHelper
    const transactionDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const discount = Number(data.discount || 0);

    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate,
      currencyCode: data.currency,
      items: data.items,
      customerId: data.customerId,
      globalDiscount: discount,
      txClient: tx,
      userId
    });

    const grandTotal = financials.subtotal + financials.totalTax - discount;

    // 3. Process invoice items with backward compatibility fields (hours, rate, amount)
    const processedItems = data.items.map((item) => {
      const orig = data.items.find(i => i.productId === item.productId || i.description === item.description) || {};
      const qty = Number(item.quantity || 0);
      const prc = Number(item.price || item.rate || 0);
      const dsc = Number(item.discount || 0);
      const amt = Math.max((qty * prc) - dsc, 0);

      const base = {
        ...item,
        hours: Number(orig.hours || 0),
        rate: prc,
        amount: amt, // backward compatibility mapping
        totalTax: 0, // This is superseded by TaxTransaction, keep 0 for backward compat structure
        totalAmount: amt,
      };
      // Remove any leftover relation fields that must be explicitly connected
      delete base.productId;
      delete base.warehouseId;
      delete base.price;
      delete base.taxRuleId;
      if (item.productId) {
        base.product = { connect: { id: item.productId } };
      }
      return base;
    });

    // 4. Create Invoice
    const invoice = await tx.invoice.create({
      data: {
        businessId,
        invoiceNumber,
        customerId: data.customerId,
        contactId: data.contactId || null,
        quotationId: data.quotationId || null,
        salesOrderId: data.salesOrderId || null,
        status: "DRAFT",
        subtotal: financials.subtotal,
        totalTax: financials.totalTax,
        discount: discount,
        grandTotal: grandTotal,
        currency: data.currency || "AED",
        
        // Legacy fields mapping
        cgst: financials.legacyTaxes.cgst,
        sgst: financials.legacyTaxes.sgst,
        igst: financials.legacyTaxes.igst,
        vatAmount: financials.legacyTaxes.vatAmount,
        
        // Engine Fields
        transactionCurrencyId: financials.currencyData.transactionCurrencyId,
        baseCurrencyId: financials.currencyData.baseCurrencyId,
        exchangeRate: financials.currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
        statutoryExchangeRate: financials.currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),
        poNumber: data.poNumber || null,
        poDate: data.poDate ? new Date(data.poDate) : null,
        soNumber: data.soNumber || null,
        soDate: data.soDate ? new Date(data.soDate) : null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        terms: data.terms || null,
        adminNote: data.adminNote || null,
        designTemplate: data.designTemplate || "modern",
        projectId: data.projectId || null,
        cgst: data.cgst || 0,
        sgst: data.sgst || 0,
        igst: data.igst || 0,
        tds: data.tds || 0,
        vatAmount: data.vatAmount || 0,
        vatPercentage: data.vatPercentage || 0,
        vatType: data.vatType || null,
        emirate: data.emirate || null,
        ewayBillNo: data.ewayBillNo || null,
        transportDetails: data.transportDetails || null,
        reverseCharge: data.reverseCharge || false,
        shippingCharges: data.shippingCharges || 0,
        items: {
          create: processedItems
        }
      },
      include: {
        items: true,
        customer: true
      }
    });

    await TransactionHelper.saveTaxLedger(tx, businessId, "INVOICE", invoice.id, financials.taxTransactions);

    // 5. Deduct Stock immediately from physical inventory
    const { totalCogs, totalGrossProfit } = await deductStock(tx, businessId, invoice.items, false);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        totalCogs,
        totalGrossProfit
      }
    });

    // 5.5 Update Project Revenue
    if (data.projectId) {
      await tx.project.update({
        where: { id: data.projectId },
        data: { 
          revenue: { increment: grandTotal },
          invoicedRevenue: { increment: grandTotal }
        }
      });
    }

    // 5.6 POST TO LEDGER
    const accounts = await getSystemAccounts(tx, businessId);
    
    // Tax Engine: Split Revenue and Tax Payable
    const taxAmountBaseCcy = CurrencyService.scaleAmount(financials.totalTax, financials.currencyData.exchangeRate, financials.currencyData.decimals);
    const grandTotalBaseCcy = invoice.baseCurrencyAmount;
    
    // Plug technique: derive revenue to guarantee perfectly balanced journal entries
    const netRevenueBaseCcy = grandTotalBaseCcy - taxAmountBaseCcy;

    // Pass the actual exchange rate for audit/reporting, but provide pre-scaled base values directly.
    const invoiceRate = financials.currencyData.exchangeRate;

    const journalEntries = [
      // Leg 1: Invoice Issue
      { businessId, accountId: accounts.SYSTEM_AR, debit: grandTotal, credit: 0, baseDebit: grandTotalBaseCcy, baseCredit: 0, description: `Invoice #${invoiceNumber}`, exchangeRate: invoiceRate },
      { businessId, accountId: accounts.SYSTEM_REVENUE, debit: 0, credit: (financials.subtotal - discount), baseDebit: 0, baseCredit: netRevenueBaseCcy, description: `Invoice #${invoiceNumber} (Net Revenue)`, exchangeRate: invoiceRate }
    ];

    if (taxAmountBaseCcy > 0) {
      journalEntries.push({ businessId, accountId: accounts.SYSTEM_TAX_PAYABLE, debit: 0, credit: financials.totalTax, baseDebit: 0, baseCredit: taxAmountBaseCcy, description: `Invoice #${invoiceNumber} (Tax)`, exchangeRate: invoiceRate });
    }

    // Leg 2: COGS / Inventory Outflow
    if (totalCogs > 0) {
      journalEntries.push(
        // COGS and Inventory are already calculated in base currency, so we pass exchangeRate: 1.0
        { businessId, accountId: accounts.SYSTEM_COGS, debit: totalCogs, credit: 0, description: `COGS for Invoice #${invoiceNumber}`, exchangeRate: 1.0 },
        { businessId, accountId: accounts.SYSTEM_INVENTORY, debit: 0, credit: totalCogs, description: `Inventory outflow for Invoice #${invoiceNumber}`, exchangeRate: 1.0 }
      );
    }

    await postJournalEntries(tx, journalEntries);

    // 6. Log & Notify
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: invoice.id,
      details: { invoiceNumber, grandTotal: grandTotal }
    });

    await triggerNotification(tx, {
      businessId,
      title: "New Invoice Billed",
      message: `Invoice ${invoiceNumber} drafted. Stock dispatched.`,
      type: "SUCCESS",
      entityType: "Invoice",
      entityId: invoice.id
    });

    return invoice;
  }, { timeout: 30000, maxWait: 30000 });
};

const convertSalesOrderToInvoice = async (businessId, userId, userEmail, salesOrderId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Sales Order
    const salesOrder = await tx.salesOrder.findFirst({
      where: { id: salesOrderId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!salesOrder) {
      throw new Error("Sales Order not found");
    }

    if (salesOrder.status === "CANCELLED" || salesOrder.status === "FULFILLED") {
      throw new Error(`Cannot bill sales order in ${salesOrder.status} status.`);
    }

    // 2. Generate unique invoice number
    const invoiceNumber = await generateDocNumber(tx, businessId, "INV", "invoice", "invoiceNumber");

    // 3. Process items copying from sales order, including backward compatibility fields
    const processedItems = salesOrder.items.map((item) => {
      const base = {
        description: item.description,
        itemType: item.itemType,
        hsnSacCode: item.hsnSacCode,
        quantity: item.quantity,
        
        
        
        
        taxDetails: item.taxDetails || [],
        discount: item.discount || 0,
        hours: 0,
        rate: item.price,
        amount: item.total,
        totalTax: item.total * ((item.taxPercent || 0) / (100 + (item.taxPercent || 0))),
        totalAmount: item.total
      };
      if (item.productId) {
        base.product = { connect: { id: item.productId } };
      }
      return base;
    });

    // 4. Create Invoice
    const invoice = await tx.invoice.create({
      data: {
        businessId,
        invoiceNumber,
        customerId: salesOrder.customerId,
        contactId: salesOrder.contactId,
        quotationId: salesOrder.quotationId,
        salesOrderId: salesOrder.id,
        status: "APPROVED",
        subtotal: salesOrder.subtotal,
        totalTax: salesOrder.tax,
        discount: salesOrder.discount,
        grandTotal: salesOrder.totalAmount,
        currency: salesOrder.currency,
        
        // Propagate Currency Fields
        transactionCurrencyId: salesOrder.transactionCurrencyId,
        baseCurrencyId: salesOrder.baseCurrencyId,
        exchangeRate: salesOrder.exchangeRate,
        baseCurrencyAmount: salesOrder.baseCurrencyAmount,
        statutoryExchangeRate: salesOrder.statutoryExchangeRate,
        statutoryBaseAmount: salesOrder.statutoryBaseAmount,

        // Propagate Legacy Tax
        cgst: salesOrder.cgst,
        sgst: salesOrder.sgst,
        igst: salesOrder.igst,
        vatAmount: salesOrder.vatAmount,

        terms: salesOrder.termsConditions,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Default 15 days due date
        soNumber: salesOrder.orderNumber,
        soDate: salesOrder.orderDate,
        items: {
          create: processedItems
        }
      },
      include: {
        items: true,
        customer: true
      }
    });

    // 4.5 Generate TaxLedger by copying sales order's ledger
    const soTaxes = await tx.taxTransaction.findMany({
      where: { transactionId: salesOrderId, transactionType: "SALES_ORDER" }
    });
    
    if (soTaxes.length > 0) {
      await tx.taxTransaction.createMany({
        data: soTaxes.map(st => {
          const { id, createdAt, updatedAt, ...copyData } = st;
          return {
            ...copyData,
            transactionType: "INVOICE",
            transactionId: invoice.id
          };
        })
      });
    }

    // 5. Deduct Stock, recognizing it was previously reserved by Sales Order
    const { totalCogs, totalGrossProfit } = await deductStock(tx, businessId, invoice.items, true);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        totalCogs,
        totalGrossProfit
      }
    });

    // 6. Complete Sales Order Fulfill Status
    await tx.salesOrder.update({
      where: { id: salesOrderId },
      data: { status: "FULFILLED" }
    });

    // 6.5 Update Project Revenue if linked
    const linkedProject = await tx.project.findFirst({
      where: { salesOrderId: salesOrderId, businessId }
    });
    if (linkedProject) {
      await tx.project.update({
        where: { id: linkedProject.id },
        data: { revenue: { increment: salesOrder.totalAmount } }
      });
    }

    // 7. Log & Notify
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "INVOICE_CONVERTED_FROM_SALES_ORDER",
      entityType: "Invoice",
      entityId: invoice.id,
      details: { salesOrderId, orderNumber: salesOrder.orderNumber, invoiceNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Invoice Billed",
      message: `Invoice ${invoiceNumber} created from Sales Order ${salesOrder.orderNumber}. Stock reservation dispatched.`,
      type: "SUCCESS",
      entityType: "Invoice",
      entityId: invoice.id
    });

    return invoice;
  }, { maxWait: 20000, timeout: 30000 });
};

const updateInvoice = async (businessId, userId, userEmail, invoiceId, data) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!existing) {
      throw new Error("Invoice not found");
    }

    if (existing.status === "PAID" || existing.status === "CANCELLED") {
      throw new Error(`Cannot edit invoice in ${existing.status} status.`);
    }

    let financials = null;
    let grandTotal = existing.grandTotal;
    let discount = existing.discount;

    // Trigger recalculation if any financial input changes
    if (data.items || data.currency || data.discount !== undefined || data.invoiceDate) {
      discount = data.discount !== undefined ? Number(data.discount) : existing.discount;
      const transactionDate = data.invoiceDate ? new Date(data.invoiceDate) : existing.invoiceDate;
      const itemsToProcess = data.items || await tx.invoiceItem.findMany({ where: { invoiceId } });

      // Restore previous dispatched stock
      await restoreStock(tx, businessId, existing.items);

      // 2. Re-calculate pricing via Engine
      financials = await TransactionHelper.processTransactionFinancials({
        businessId,
        transactionDate,
        currencyCode: data.currency || existing.currency,
        items: itemsToProcess,
        customerId: data.customerId || existing.customerId,
        globalDiscount: discount,
        userId,
        txClient: tx
      });
      
      grandTotal = financials.subtotal + financials.totalTax - discount;

      // Process invoice items
      const processedItems = itemsToProcess.map((item) => {
        const orig = (data.items || []).find(i => i.productId === item.productId || i.description === item.description) || {};
        const qty = Number(item.quantity || 0);
        const prc = Number(item.price || item.rate || 0);
        const dsc = Number(item.discount || 0);
        const amt = Math.max((qty * prc) - dsc, 0);

        const base = {
          ...item,
          hours: Number(orig.hours || 0),
          rate: prc,
          amount: amt,
          totalTax: 0,
          totalAmount: amt
        };
        // Remove relation fields that must be connected
        delete base.productId;
        delete base.warehouseId;
        delete base.invoiceId;
        delete base.id;
        delete base.price;
        delete base.taxRuleId;
        if (item.productId) {
          base.product = { connect: { id: item.productId } };
        }
        return base;
      });

      if (data.items) {
        // Delete old items
        await tx.invoiceItem.deleteMany({
          where: { invoiceId }
        });
        
        financials.processedItemsToSave = processedItems;
      }

      await tx.taxTransaction.deleteMany({
        where: { transactionId: invoiceId, transactionType: "INVOICE" }
      });
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        customerId: data.customerId || existing.customerId,
        contactId: data.contactId !== undefined ? data.contactId : existing.contactId,
        quotationId: data.quotationId !== undefined ? data.quotationId : existing.quotationId,
        salesOrderId: data.salesOrderId !== undefined ? data.salesOrderId : existing.salesOrderId,
        status: data.status || existing.status,
        subtotal: financials ? financials.subtotal : existing.subtotal,
        totalTax: financials ? financials.totalTax : existing.totalTax,
        discount: discount,
        grandTotal: grandTotal,
        currency: data.currency || existing.currency,
        
        // Legacy Tax Projections
        ...(financials ? {
          cgst: financials.legacyTaxes.cgst,
          sgst: financials.legacyTaxes.sgst,
          igst: financials.legacyTaxes.igst,
          vatAmount: financials.legacyTaxes.vatAmount
        } : {}),
        
        // Engine Fields
        ...(financials ? {
          transactionCurrencyId: financials.currencyData.transactionCurrencyId,
          baseCurrencyId: financials.currencyData.baseCurrencyId,
          exchangeRate: financials.currencyData.exchangeRate,
          baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
          statutoryExchangeRate: financials.currencyData.statutoryRate,
          statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),
        } : {}),

        poNumber: data.poNumber !== undefined ? data.poNumber : existing.poNumber,
        poDate: data.poDate !== undefined ? (data.poDate ? new Date(data.poDate) : null) : existing.poDate,
        soNumber: data.soNumber !== undefined ? data.soNumber : existing.soNumber,
        soDate: data.soDate !== undefined ? (data.soDate ? new Date(data.soDate) : null) : existing.soDate,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : existing.invoiceDate,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : existing.dueDate,
        terms: data.terms !== undefined ? data.terms : existing.terms,
        adminNote: data.adminNote !== undefined ? data.adminNote : existing.adminNote,
        designTemplate: data.designTemplate !== undefined ? data.designTemplate : existing.designTemplate,
        projectId: data.projectId !== undefined ? data.projectId : existing.projectId,
        vatPercentage: data.vatPercentage !== undefined ? data.vatPercentage : existing.vatPercentage,
        vatType: data.vatType !== undefined ? data.vatType : existing.vatType,
        emirate: data.emirate !== undefined ? data.emirate : existing.emirate,
        ewayBillNo: data.ewayBillNo !== undefined ? data.ewayBillNo : existing.ewayBillNo,
        transportDetails: data.transportDetails !== undefined ? data.transportDetails : existing.transportDetails,
        reverseCharge: data.reverseCharge !== undefined ? data.reverseCharge : existing.reverseCharge,
        shippingCharges: data.shippingCharges !== undefined ? data.shippingCharges : existing.shippingCharges,
        items: (financials && data.items) ? {
          create: financials.processedItemsToSave
        } : undefined
      },
      include: {
        items: true,
        customer: true
      }
    });

    if (financials) {
      if (data.items) {
        const { totalCogs, totalGrossProfit } = await deductStock(tx, businessId, updated.items, false);
        await tx.invoice.update({
          where: { id: updated.id },
          data: { totalCogs, totalGrossProfit }
        });
      }
      
      await TransactionHelper.saveTaxLedger(tx, businessId, "INVOICE", updated.id, financials.taxTransactions);
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "INVOICE_UPDATED",
      entityType: "Invoice",
      entityId: updated.id,
      details: { invoiceNumber: updated.invoiceNumber }
    });

    return updated;
  });
};

const getInvoiceById = async (businessId, invoiceId) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId, isDeleted: false },
    include: {
      items: true,
      customer: true,
      contact: true,
      quotation: true,
      salesOrder: true,
      payments: true,
      creditNotes: true,
      project: true
    }
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  return invoice;
};

const deleteInvoice = async (businessId, userId, userEmail, invoiceId) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!existing) {
      throw new Error("Invoice not found");
    }

    // Restore stock to inventory
    await restoreStock(tx, businessId, existing.items);

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "INVOICE_DELETED",
      entityType: "Invoice",
      entityId: invoiceId,
      details: { invoiceNumber: existing.invoiceNumber }
    });

    return true;
  });
};

const changeStatus = async (businessId, userId, userEmail, invoiceId, status) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!existing) {
      throw new Error("Invoice not found");
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status }
    });

    // If invoice is cancelled, restore physical inventory stock
    if (status === "CANCELLED") {
      await restoreStock(tx, businessId, existing.items);
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "INVOICE_STATUS_CHANGED",
      entityType: "Invoice",
      entityId: invoiceId,
      details: { oldStatus: existing.status, newStatus: status, invoiceNumber: existing.invoiceNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Invoice Status Updated",
      message: `Invoice ${existing.invoiceNumber} status is now ${status}.`,
      type: status === "PAID" ? "SUCCESS" : "INFO",
      entityType: "Invoice",
      entityId: invoiceId
    });

    return updated;
  });
};

module.exports = {
  createInvoice,
  convertSalesOrderToInvoice,
  updateInvoice,
  getInvoiceById,
  deleteInvoice,
  changeStatus,
  deductStock,
  restoreStock
};
