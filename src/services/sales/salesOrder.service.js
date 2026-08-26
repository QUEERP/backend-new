const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("./audit.service");
const { reserveStock: reserveStockHelper, releaseReservedStock } = require("../inventory/movement.service");
const TransactionHelper = require("../TransactionHelper");
const { CurrencyService } = require("../currencyService");

/**
 * Enterprise Stock Reservation logic
 */
const reserveStock = async (tx, businessId, items) => {
  for (const item of items) {
    if (!item.productId) continue;

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { type: true, name: true }
    });

    if (product?.type === 'SERVICE') continue;

    if (!item.warehouseId) {
      throw new Error(`Warehouse is required for goods item: ${product.name}`);
    }

    const stockRecord = await tx.stock.findFirst({
      where: {
        productId: item.productId,
        warehouseId: item.warehouseId
      }
    });

    if (!stockRecord) {
      // Optional: Initialize stock record if it doesn't exist
      await tx.stock.create({
        data: {
          productId: item.productId,
          warehouseId: item.warehouseId
        }
      });
    }

    await reserveStockHelper(tx, {
      businessId,
      productId: item.productId,
      warehouseId: item.warehouseId,
      quantity: item.quantity
    });
  }
};

/**
 * Releases reserved stock back to available pool
 */
const releaseStock = async (tx, businessId, items) => {
  for (const item of items) {
    if (!item.productId || !item.warehouseId) continue;

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { type: true }
    });

    if (product?.type === 'SERVICE') continue;

    await releaseReservedStock(tx, {
      businessId,
      productId: item.productId,
      warehouseId: item.warehouseId,
      quantity: item.quantity
    });

  }
};

const createSalesOrder = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Generate unique SO number
    const orderNumber = await generateDocNumber(tx, businessId, "SO", "salesOrder", "orderNumber");

    // 2. Compute pricing via TransactionHelper
    const transactionDate = data.orderDate ? new Date(data.orderDate) : new Date();
    const discount = Number(data.discount || 0);

    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate,
      currencyCode: data.currency,
      items: data.items,
      customerId: data.customerId,
      globalDiscount: discount,
      txClient: tx
    });

    const grandTotal = financials.subtotal + financials.totalTax - discount;

    // 3. Create Sales Order
    const salesOrder = await tx.salesOrder.create({
      data: {
        businessId,
        orderNumber,
        customerId: data.customerId,
        contactId: data.contactId || null,
        quotationId: data.quotationId || null,
        dealId: data.dealId || null,
        assignedToId: data.assignedToId || null,
        status: "DRAFT",
        subtotal: financials.subtotal,
        tax: financials.totalTax,
        discount: discount,
        totalAmount: grandTotal,
        currency: data.currency || "INR",
        
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

        termsConditions: data.termsConditions || null,
        orderDate: transactionDate,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes || null,
        items: {
          create: data.items.map(item => {
            const { warehouseId, productId, itemName, ...rest } = item;
            const payload = { ...rest };
            if (productId) payload.product = { connect: { id: productId } };
            if (warehouseId) payload.warehouse = { connect: { id: warehouseId } };
            return payload;
          })
        }
      },
      include: {
        items: true,
        customer: true
      }
    });

    await TransactionHelper.saveTaxLedger(tx, businessId, "SALES_ORDER", salesOrder.id, financials.taxTransactions);

    // 4. Reserve Stock
    await reserveStock(tx, businessId, salesOrder.items);

    // 5. Log & Notify
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "SALES_ORDER_CREATED",
      entityType: "SalesOrder",
      entityId: salesOrder.id,
      details: { orderNumber, totalAmount: grandTotal }
    });

    await triggerNotification(tx, {
      businessId,
      title: "New Sales Order Created",
      message: `Sales Order ${orderNumber} created. Stock has been reserved.`,
      type: "SUCCESS",
      entityType: "SalesOrder",
      entityId: salesOrder.id
    });

    return salesOrder;
  });
};

const convertQuotationToSalesOrder = async (businessId, userId, userEmail, quotationId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch quotation
    const quotation = await tx.quotation.findFirst({
      where: { id: quotationId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!quotation) {
      throw new Error("Quotation not found");
    }

    if (quotation.status === "EXPIRED" || quotation.status === "CANCELLED") {
      throw new Error(`Cannot convert quotation in ${quotation.status} status.`);
    }

    // 2. Generate unique SO number
    const orderNumber = await generateDocNumber(tx, businessId, "SO", "salesOrder", "orderNumber");

    // 3. Process items
    const processedItems = quotation.items.map((item) => ({
      productId: item.productId,
      description: item.description,
      itemType: item.itemType,
      hsnSacCode: item.hsnSacCode,
      quantity: item.quantity,
      price: item.price,
      taxPercent: item.taxPercent,
      taxDetails: item.taxDetails || [],
      discount: item.discount || 0,
      total: item.total
    }));

    // 4. Create Sales Order
    const salesOrder = await tx.salesOrder.create({
      data: {
        businessId,
        orderNumber,
        customerId: quotation.customerId,
        contactId: quotation.contactId,
        quotationId: quotation.id,
        dealId: quotation.dealId,
        assignedToId: quotation.assignedToId,
        status: "CONFIRMED",
        subtotal: quotation.subtotal,
        tax: quotation.tax,
        discount: quotation.discount,
        totalAmount: quotation.totalAmount,
        currency: quotation.currency,
        
        // Propagate Currency Fields
        transactionCurrencyId: quotation.transactionCurrencyId,
        baseCurrencyId: quotation.baseCurrencyId,
        exchangeRate: quotation.exchangeRate,
        baseCurrencyAmount: quotation.baseCurrencyAmount,
        statutoryExchangeRate: quotation.statutoryExchangeRate,
        statutoryBaseAmount: quotation.statutoryBaseAmount,

        // Propagate Legacy Tax
        cgst: quotation.cgst,
        sgst: quotation.sgst,
        igst: quotation.igst,
        vatAmount: quotation.vatAmount,

        termsConditions: quotation.termsConditions,
        orderDate: new Date(),
        items: {
          create: processedItems
        }
      },
      include: {
        items: true,
        customer: true
      }
    });

    // 4.5 Generate TaxLedger by copying quotation's ledger
    const quoteTaxes = await tx.taxTransaction.findMany({
      where: { transactionId: quotationId, transactionType: "QUOTATION" }
    });
    
    if (quoteTaxes.length > 0) {
      await tx.taxTransaction.createMany({
        data: quoteTaxes.map(qt => {
          const { id, createdAt, updatedAt, ...copyData } = qt;
          return {
            ...copyData,
            transactionType: "SALES_ORDER",
            transactionId: salesOrder.id
          };
        })
      });
    }

    // 5. Reserve Stock
    await reserveStock(tx, businessId, processedItems);

    // 6. Update Quotation Status
    await tx.quotation.update({
      where: { id: quotationId },
      data: { status: "ACCEPTED" }
    });

    // 7. Log & Notify
    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "SALES_ORDER_CONVERTED_FROM_QUOTATION",
      entityType: "SalesOrder",
      entityId: salesOrder.id,
      details: { quotationId, quoteNumber: quotation.quoteNumber, orderNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Sales Order Converted",
      message: `Quotation ${quotation.quoteNumber} converted to Sales Order ${orderNumber}.`,
      type: "SUCCESS",
      entityType: "SalesOrder",
      entityId: salesOrder.id
    });

    return salesOrder;
  });
};

const updateSalesOrder = async (businessId, userId, userEmail, orderId, data) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findFirst({
      where: { id: orderId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!existing) {
      throw new Error("Sales Order not found");
    }

    if (existing.status === "CANCELLED" || existing.status === "FULFILLED") {
      throw new Error(`Cannot update order in ${existing.status} status.`);
    }

    let financials = null;
    let grandTotal = existing.totalAmount;
    let discount = existing.discount;

    // Trigger recalculation if any financial input changes: items, currency, discount, or date
    if (data.items || data.currency || data.discount !== undefined || data.orderDate) {
      discount = data.discount !== undefined ? Number(data.discount) : existing.discount;
      const transactionDate = data.orderDate ? new Date(data.orderDate) : existing.orderDate;
      const itemsToProcess = data.items || await tx.salesOrderItem.findMany({ where: { salesOrderId: orderId } });

      // 1. Release previous stock reservation
      await releaseStock(tx, businessId, existing.items);

      // 2. Re-calculate pricing via Engine
      financials = await TransactionHelper.processTransactionFinancials({
        businessId,
        transactionDate,
        currencyCode: data.currency || existing.currency,
        items: itemsToProcess,
        customerId: data.customerId || existing.customerId,
        globalDiscount: discount,
        txClient: tx
      });
      
      grandTotal = financials.subtotal + financials.totalTax - discount;

      if (data.items) {
        // Delete old items if fully replacing them
        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: orderId } });
      }

      await tx.taxTransaction.deleteMany({
        where: { transactionId: orderId, transactionType: "SALES_ORDER" }
      });
    }

    const updated = await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        customerId: data.customerId || existing.customerId,
        contactId: data.contactId !== undefined ? data.contactId : existing.contactId,
        dealId: data.dealId !== undefined ? data.dealId : existing.dealId,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : existing.assignedToId,
        status: data.status ? data.status.toUpperCase() : existing.status,
        subtotal: financials ? financials.subtotal : existing.subtotal,
        tax: financials ? financials.totalTax : existing.tax,
        discount: discount,
        totalAmount: grandTotal,
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

        termsConditions: data.termsConditions !== undefined ? data.termsConditions : existing.termsConditions,
        orderDate: data.orderDate ? new Date(data.orderDate) : existing.orderDate,
        deliveryDate: data.deliveryDate !== undefined ? (data.deliveryDate ? new Date(data.deliveryDate) : null) : existing.deliveryDate,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        items: data.items ? {
          create: data.items.map(item => {
            const { warehouseId, productId, itemName, ...rest } = item;
            const payload = { ...rest };
            if (productId) payload.product = { connect: { id: productId } };
            if (warehouseId) payload.warehouse = { connect: { id: warehouseId } };
            return payload;
          })
        } : undefined
      },
      include: {
        items: true,
        customer: true
      }
    });

    if (financials) {
      await reserveStock(tx, businessId, updated.items);
      await TransactionHelper.saveTaxLedger(tx, businessId, "SALES_ORDER", updated.id, financials.taxTransactions);
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "SALES_ORDER_UPDATED",
      entityType: "SalesOrder",
      entityId: updated.id,
      details: { orderNumber: updated.orderNumber }
    });

    return updated;
  });
};

const getSalesOrderById = async (businessId, orderId) => {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    include: {
      items: true,
      customer: true,
      contact: true,
      quotation: true,
      deal: true,
      invoices: true,
      assignedTo: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error("Sales Order not found");
  }

  return order;
};

const deleteSalesOrder = async (businessId, userId, userEmail, orderId) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findFirst({
      where: { id: orderId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!existing) {
      throw new Error("Sales Order not found");
    }

    // Release stock reservation
    await releaseStock(tx, businessId, existing.items);

    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "SALES_ORDER_DELETED",
      entityType: "SalesOrder",
      entityId: orderId,
      details: { orderNumber: existing.orderNumber }
    });

    return true;
  });
};

const changeStatus = async (businessId, userId, userEmail, orderId, status) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findFirst({
      where: { id: orderId, businessId, isDeleted: false },
      include: { items: true }
    });

    if (!existing) {
      throw new Error("Sales Order not found");
    }

    const updated = await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: status.toUpperCase() }
    });

    // If order is cancelled, release reserved stock
    if (status === "CANCELLED") {
      await releaseStock(tx, businessId, existing.items);
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "SALES_ORDER_STATUS_CHANGED",
      entityType: "SalesOrder",
      entityId: orderId,
      details: { oldStatus: existing.status, newStatus: status, orderNumber: existing.orderNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Sales Order Status Changed",
      message: `Sales Order ${existing.orderNumber} status changed to ${status}.`,
      type: status === "CONFIRMED" || status === "FULFILLED" ? "SUCCESS" : "INFO",
      entityType: "SalesOrder",
      entityId: orderId
    });

    return updated;
  });
};

module.exports = {
  createSalesOrder,
  convertQuotationToSalesOrder,
  updateSalesOrder,
  getSalesOrderById,
  deleteSalesOrder,
  changeStatus,
  reserveStock,
  releaseStock
};
