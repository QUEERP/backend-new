const prisma = require("../../config/prisma");
const { logAction } = require("../sales/audit.service");
const { generateDocNumber } = require("../sales/quotation.service");
const { adjustIncomingStock } = require("../inventory/movement.service");
const TransactionHelper = require("../TransactionHelper");
const { CurrencyService } = require("../currencyService");

const getPagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const calculatePOPricing = (items) => {
  let subtotal = 0;
  let totalTax = 0;

  const processedItems = items.map(item => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const taxPercent = parseFloat(item.taxPercent) || 0;
    
    const itemSubtotal = qty * price;
    const itemTax = itemSubtotal * (taxPercent / 100);
    const itemTotal = itemSubtotal + itemTax;

    subtotal += itemSubtotal;
    totalTax += itemTax;

    return {
      productId: item.productId || null,
      description: item.description,
      itemType: item.itemType || "GOODS",
      hsnSacCode: item.hsnSacCode || null,
      quantity: qty,
      price: price,
      taxPercent: taxPercent,
      total: itemTotal
    };
  });

  const totalAmount = subtotal + totalTax;

  return {
    subtotal,
    tax: totalTax,
    totalAmount,
    processedItems
  };
};

const createPurchaseOrder = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // Generate unique PO number
    const poNumber = await generateDocNumber(tx, businessId, "PO", "purchaseOrder", "poNumber");

    const transactionDate = data.orderDate ? new Date(data.orderDate) : new Date();
    const discount = data.discount ? parseFloat(data.discount) : 0;

    // Use Engine for pricing, tax, and multi-currency
    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate,
      currencyCode: data.currency || "AED",
      items: data.items || [],
      customerId: null, // PO doesn't use customer state
      globalDiscount: discount,
      txClient: tx
    });

    const grandTotal = financials.subtotal + financials.totalTax - discount;

    const processedItems = data.items.map(item => {
      const origQty = parseFloat(item.quantity || 0);
      const origPrice = parseFloat(item.price || 0);
      const sub = origQty * origPrice;
      const taxAmt = item.taxPercent ? sub * (parseFloat(item.taxPercent) / 100) : 0;
      
      return {
        productId: item.productId || null,
        description: item.description,
        itemType: item.itemType || "GOODS",
        hsnSacCode: item.hsnSacCode || null,
        quantity: origQty,
        price: origPrice,
        taxPercent: item.taxPercent ? parseFloat(item.taxPercent) : 0,
        total: sub + taxAmt
      };
    });

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        businessId,
        poNumber,
        vendorId: data.vendorId,
        warehouseId: data.warehouseId || null,
        assignedToId: data.assignedToId || null,
        status: data.status || "DRAFT",
        subtotal: financials.subtotal,
        tax: financials.totalTax,
        discount: discount,
        totalAmount: grandTotal,
        currency: data.currency || "AED",
        
        // Currency engine fields
        transactionCurrencyId: financials.currencyData.transactionCurrencyId,
        baseCurrencyId: financials.currencyData.baseCurrencyId,
        exchangeRate: financials.currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
        statutoryExchangeRate: financials.currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),
        


        orderDate: transactionDate,
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        notes: data.notes || null,
        items: {
          create: processedItems
        }
      },
      include: {
        items: true,
        vendor: true
      }
    });

    await TransactionHelper.saveTaxLedger(tx, businessId, "PURCHASE_ORDER", purchaseOrder.id, financials.taxTransactions);

    // If initial status is APPROVED, adjust incoming stock
    if (purchaseOrder.status === "APPROVED" && purchaseOrder.warehouseId) {
      for (const item of processedItems) {
        if (item.productId && item.itemType === "GOODS") {
          await adjustIncomingStock(tx, {
            businessId,
            productId: item.productId,
            warehouseId: purchaseOrder.warehouseId,
            quantity: item.quantity
          });
        }
      }
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PURCHASE_ORDER_CREATED",
      module: "PURCHASE",
      entityType: "PurchaseOrder",
      entityId: purchaseOrder.id,
      details: { poNumber, totalAmount: purchaseOrder.totalAmount }
    });

    return purchaseOrder;
  });
};

const getPurchaseOrders = async (businessId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = { businessId };

  if (query.status) {
    where.status = query.status;
  }
  if (query.vendorId) {
    where.vendorId = query.vendorId;
  }
  if (query.search) {
    where.poNumber = { contains: query.search, mode: "insensitive" };
  }

  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";
  const orderBy = { [sortBy]: sortOrder };

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limit,
      include: {
        vendor: { select: { id: true, name: true, companyName: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        }
      },
      orderBy
    }),
    prisma.purchaseOrder.count({ where })
  ]);

  return {
    orders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

const getPurchaseOrderById = async (businessId, id) => {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, businessId },
    include: {
      vendor: true,
      warehouse: true,
      items: {
        include: {
          product: true
        }
      },
      goodsReceiveNotes: true,
      bills: true
    }
  });

  if (!order) throw new Error("Purchase Order not found");
  return order;
};

const updatePurchaseOrder = async (businessId, userId, userEmail, id, data) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: true }
    });

    if (!existing) throw new Error("Purchase Order not found");
    if (existing.status !== "DRAFT" && existing.status !== "PENDING_APPROVAL") {
      throw new Error(`Cannot update purchase order in ${existing.status} status.`);
    }

    let financials = null;
    let grandTotal = existing.totalAmount;
    let discount = existing.discount;

    // Trigger recalculation if any financial input changes
    if (data.items || data.currency || data.discount !== undefined || data.orderDate) {
      discount = data.discount !== undefined ? parseFloat(data.discount) : existing.discount;
      const transactionDate = data.orderDate ? new Date(data.orderDate) : existing.orderDate;
      const itemsToProcess = data.items || await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });

      financials = await TransactionHelper.processTransactionFinancials({
        businessId,
        transactionDate,
        currencyCode: data.currency || existing.currency || "AED",
        items: itemsToProcess,
        customerId: null,
        globalDiscount: discount,
        txClient: tx
      });
      
      grandTotal = financials.subtotal + financials.totalTax - discount;

      const processedItems = itemsToProcess.map(item => {
        const origQty = parseFloat(item.quantity || 0);
        const origPrice = parseFloat(item.price || 0);
        const sub = origQty * origPrice;
        const taxAmt = item.taxPercent ? sub * (parseFloat(item.taxPercent) / 100) : 0;
        
        return {
          productId: item.productId || null,
          description: item.description,
          itemType: item.itemType || "GOODS",
          hsnSacCode: item.hsnSacCode || null,
          quantity: origQty,
          price: origPrice,
          taxPercent: item.taxPercent ? parseFloat(item.taxPercent) : 0,
          total: sub + taxAmt
        };
      });

      if (data.items) {
        if (existing.status === "APPROVED" && existing.warehouseId) {
          for (const item of existing.items) {
            if (item.productId && item.itemType === "GOODS") {
              await adjustIncomingStock(tx, {
                businessId,
                productId: item.productId,
                warehouseId: existing.warehouseId,
                quantity: -item.quantity
              });
            }
          }
        }
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id }
        });
        financials.processedItemsToSave = processedItems;
      }

      await tx.taxTransaction.deleteMany({
        where: { transactionId: id, transactionType: "PURCHASE_ORDER" }
      });
    }

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        vendorId: data.vendorId || existing.vendorId,
        warehouseId: data.warehouseId !== undefined ? data.warehouseId : existing.warehouseId,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : existing.assignedToId,
        status: data.status || existing.status,
        subtotal: financials ? financials.subtotal : existing.subtotal,
        tax: financials ? financials.totalTax : existing.tax,
        discount: discount,
        totalAmount: grandTotal,
        currency: data.currency || existing.currency,
        
        // Currency engine fields
        ...(financials ? {
          transactionCurrencyId: financials.currencyData.transactionCurrencyId,
          baseCurrencyId: financials.currencyData.baseCurrencyId,
          exchangeRate: financials.currencyData.exchangeRate,
          baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
          statutoryExchangeRate: financials.currencyData.statutoryRate,
          statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),
        } : {}),

        orderDate: data.orderDate ? new Date(data.orderDate) : existing.orderDate,
        expectedDeliveryDate: data.expectedDeliveryDate !== undefined ? (data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null) : existing.expectedDeliveryDate,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        items: (financials && data.items) ? {
          create: financials.processedItemsToSave
        } : undefined
      },
      include: {
        items: true
      }
    });

    if (financials) {
      await TransactionHelper.saveTaxLedger(tx, businessId, "PURCHASE_ORDER", updated.id, financials.taxTransactions);
    }

    if (updated.status === "APPROVED" && updated.warehouseId) {
      const itemsToAdjust = (financials && data.items) ? financials.processedItemsToSave : existing.items;
      for (const item of itemsToAdjust) {
        if (item.productId && (item.itemType === "GOODS" || item.product?.type === "GOODS")) {
          await adjustIncomingStock(tx, {
            businessId,
            productId: item.productId,
            warehouseId: updated.warehouseId,
            quantity: item.quantity
          });
        }
      }
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PURCHASE_ORDER_UPDATED",
      module: "PURCHASE",
      entityType: "PurchaseOrder",
      entityId: id,
      details: { poNumber: updated.poNumber }
    });

    return updated;
  });
};

const changePOStatus = async (businessId, userId, userEmail, id, status) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: true }
    });

    if (!existing) throw new Error("Purchase Order not found");
    if (existing.status === status) return existing;

    // Handle incoming stock changes based on status transition
    if (status === "APPROVED" && existing.warehouseId) {
      for (const item of existing.items) {
        if (item.productId && item.itemType === "GOODS") {
          await adjustIncomingStock(tx, {
            businessId,
            productId: item.productId,
            warehouseId: existing.warehouseId,
            quantity: item.quantity
          });
        }
      }
    } else if (status === "CANCELLED" && existing.status === "APPROVED" && existing.warehouseId) {
      // Deduct incoming stock because it is cancelled
      for (const item of existing.items) {
        if (item.productId && item.itemType === "GOODS") {
          await adjustIncomingStock(tx, {
            businessId,
            productId: item.productId,
            warehouseId: existing.warehouseId,
            quantity: -item.quantity
          });
        }
      }
    }

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: { status },
      include: { items: true }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PURCHASE_ORDER_STATUS_CHANGED",
      module: "PURCHASE",
      entityType: "PurchaseOrder",
      entityId: id,
      details: { poNumber: existing.poNumber, oldStatus: existing.status, newStatus: status }
    });

    return updated;
  });
};

module.exports = {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  changePOStatus,
  calculatePOPricing
};
