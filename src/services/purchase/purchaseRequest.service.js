const prisma = require("../../config/prisma");
const { logAction } = require("../sales/audit.service");
const { generateDocNumber } = require("../sales/quotation.service");
const { CurrencyService } = require("../currencyService");
const TransactionHelper = require("../TransactionHelper");

const getPagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const createPurchaseRequest = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // Generate Request Number
    const requestNumber = await generateDocNumber(tx, businessId, "PR", "purchaseRequest", "requestNumber");

    let estimatedTotal = 0;
    const processedItems = data.items.map(item => {
      const quantity = parseFloat(item.quantity || 0);
      const estimatedPrice = item.estimatedPrice ? parseFloat(item.estimatedPrice) : 0;
      estimatedTotal += (quantity * estimatedPrice);
      return {
        productId: item.productId,
        description: item.description || "",
        quantity,
        estimatedPrice
      };
    });

    const transactionDate = data.requestDate ? new Date(data.requestDate) : new Date();
    const currencyCode = data.currency || "AED";
    
    let currencyData = null;
    try {
      currencyData = await CurrencyService.resolveCurrencyData(businessId, currencyCode, transactionDate);
    } catch (e) {
      // Soft fallback for PRs: don't block draft pre-approvals on missing strict rates
      const business = await tx.business.findUnique({ where: { id: businessId } });
      const txnCur = await tx.currency.findUnique({ where: { code: currencyCode } });
      if (business && business.baseCurrencyId && txnCur) {
        currencyData = {
          transactionCurrencyId: txnCur.id,
          baseCurrencyId: business.baseCurrencyId,
          exchangeRate: null,
          statutoryRate: null,
          rateIsEstimated: true,
          decimals: txnCur.decimals || 2
        };
      } else {
        throw e; // if we can't find currencies at all, rethrow
      }
    }

    const purchaseRequest = await tx.purchaseRequest.create({
      data: {
        businessId,
        requestNumber,
        projectId: data.projectId || null,
        department: data.department || null,
        requesterId: data.requesterId || null,
        status: data.status || "DRAFT",
        notes: data.notes || null,
        transactionCurrencyId: currencyData.transactionCurrencyId,
        baseCurrencyId: currencyData.baseCurrencyId,
        exchangeRate: currencyData.exchangeRate,
        baseCurrencyAmount: currencyData.exchangeRate !== null ? CurrencyService.scaleAmount(estimatedTotal, currencyData.exchangeRate, currencyData.decimals) : null,
        statutoryExchangeRate: currencyData.statutoryRate,
        statutoryBaseAmount: currencyData.statutoryRate !== null ? CurrencyService.scaleAmount(estimatedTotal, currencyData.statutoryRate, currencyData.decimals) : null,
        rateIsEstimated: currencyData.rateIsEstimated || false,
        items: {
          create: processedItems
        }
      },
      include: {
        items: true
      }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PURCHASE_REQUEST_CREATED",
      module: "PURCHASE",
      entityType: "PurchaseRequest",
      entityId: purchaseRequest.id,
      details: { requestNumber, status: purchaseRequest.status }
    });

    return purchaseRequest;
  });
};

const getPurchaseRequests = async (businessId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = { businessId };

  if (query.status) {
    where.status = query.status;
  }
  if (query.search) {
    where.requestNumber = { contains: query.search, mode: "insensitive" };
  }

  const [requests, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        requester: { select: { id: true, user: { select: { name: true, email: true } } } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.purchaseRequest.count({ where })
  ]);

  return {
    requests,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

const getPurchaseRequestById = async (businessId, id) => {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id, businessId },
    include: {
      requester: { select: { id: true, user: { select: { name: true, email: true } } } },
      items: {
        include: {
          product: true
        }
      }
    }
  });

  if (!request) throw new Error("Purchase Request not found");
  return request;
};

const updatePurchaseRequest = async (businessId, userId, userEmail, id, data) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseRequest.findFirst({
      where: { id, businessId }
    });
    if (!existing) throw new Error("Purchase Request not found");

    if (existing.status !== "DRAFT" && existing.status !== "PENDING_APPROVAL") {
      throw new Error(`Cannot update purchase request in ${existing.status} status.`);
    }

    let estimatedTotal = 0;
    const itemsToProcess = data.items || await tx.purchaseRequestItem.findMany({ where: { purchaseRequestId: id } });
    
    const processedItems = itemsToProcess.map(item => {
      const quantity = parseFloat(item.quantity || 0);
      const estimatedPrice = item.estimatedPrice ? parseFloat(item.estimatedPrice) : 0;
      estimatedTotal += (quantity * estimatedPrice);
      return {
        productId: item.productId,
        description: item.description || "",
        quantity,
        estimatedPrice
      };
    });

    let currencyData = null;
    const isCurrencyUpdated = data.currency || data.requestDate || data.items;
    
    if (isCurrencyUpdated) {
      const transactionDate = data.requestDate ? new Date(data.requestDate) : existing.createdAt;
      // Fetch original code to use as fallback if not provided
      let originalCurrencyCode = "AED";
      if (existing.transactionCurrencyId) {
         const tCur = await tx.currency.findUnique({ where: { id: existing.transactionCurrencyId } });
         if (tCur) originalCurrencyCode = tCur.code;
      }
      const currencyCode = data.currency || originalCurrencyCode;

      try {
        currencyData = await CurrencyService.resolveCurrencyData(businessId, currencyCode, transactionDate);
      } catch (e) {
        // Soft fallback
        const business = await tx.business.findUnique({ where: { id: businessId } });
        const txnCur = await tx.currency.findUnique({ where: { code: currencyCode } });
        if (business && business.baseCurrencyId && txnCur) {
          currencyData = {
            transactionCurrencyId: txnCur.id,
            baseCurrencyId: business.baseCurrencyId,
            exchangeRate: null,
            statutoryRate: null,
            rateIsEstimated: true,
            decimals: txnCur.decimals || 2
          };
        } else {
          throw e;
        }
      }
    }

    if (data.items) {
      // Re-create items
      await tx.purchaseRequestItem.deleteMany({
        where: { purchaseRequestId: id }
      });
    }

    const updated = await tx.purchaseRequest.update({
      where: { id },
      data: {
        department: data.department !== undefined ? data.department : existing.department,
        requesterId: data.requesterId !== undefined ? data.requesterId : existing.requesterId,
        status: data.status || existing.status,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        ...(currencyData ? {
          transactionCurrencyId: currencyData.transactionCurrencyId,
          baseCurrencyId: currencyData.baseCurrencyId,
          exchangeRate: currencyData.exchangeRate,
          baseCurrencyAmount: currencyData.exchangeRate !== null ? CurrencyService.scaleAmount(estimatedTotal, currencyData.exchangeRate, currencyData.decimals) : null,
          statutoryExchangeRate: currencyData.statutoryRate,
          statutoryBaseAmount: currencyData.statutoryRate !== null ? CurrencyService.scaleAmount(estimatedTotal, currencyData.statutoryRate, currencyData.decimals) : null,
          rateIsEstimated: currencyData.rateIsEstimated || false,
        } : {}),
        items: data.items ? {
          create: processedItems
        } : undefined
      },
      include: {
        items: true
      }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PURCHASE_REQUEST_UPDATED",
      module: "PURCHASE",
      entityType: "PurchaseRequest",
      entityId: id,
      details: { requestNumber: updated.requestNumber }
    });

    return updated;
  });
};

const convertToPurchaseOrder = async (businessId, userId, userEmail, id, vendorId, warehouseId) => {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.findFirst({
      where: { id, businessId, isDeleted: false },
      include: { items: { include: { product: true } } }
    });

    if (!request) throw new Error("Purchase Request not found");
    if (request.status !== "APPROVED") {
      throw new Error("Only APPROVED purchase requests can be converted to Purchase Orders.");
    }

    // Generate PO Number
    const poNumber = await generateDocNumber(tx, businessId, "PO", "purchaseOrder", "poNumber");
    const currencyCode = request.transactionCurrencyId ? (await tx.currency.findUnique({ where: { id: request.transactionCurrencyId } })).code : "AED";
    const transactionDate = new Date();

    const itemsToProcess = request.items.map(item => ({
        productId: item.productId,
        description: item.description || item.product.name,
        quantity: item.quantity,
        price: item.estimatedPrice || item.product.costPrice || 0,
        
        itemType: item.product.type || "GOODS",
        hsnSacCode: item.product.taxCode || ""
    }));

    // Re-resolve strict currency logic on conversion via TransactionHelper
    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate,
      currencyCode,
      items: itemsToProcess,
      customerId: null,
      globalDiscount: 0,
      userId,
      txClient: tx
    });

    const grandTotal = financials.subtotal + financials.totalTax;

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        businessId,
        poNumber,
        projectId: request.projectId,
        vendorId,
        warehouseId,
        status: "DRAFT",
        subtotal: financials.subtotal,
        tax: financials.totalTax,
        discount: 0,
        totalAmount: grandTotal,
        currency: currencyCode,
        
        // Strictly resolved currency engine fields
        transactionCurrencyId: financials.currencyData.transactionCurrencyId,
        baseCurrencyId: financials.currencyData.baseCurrencyId,
        exchangeRate: financials.currencyData.exchangeRate,
        baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
        statutoryExchangeRate: financials.currencyData.statutoryRate,
        statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),
        


        orderDate: transactionDate,
        items: {
          create: financials.processedItemsToSave
        }
      },
      include: {
        items: true
      }
    });

    await TransactionHelper.saveTaxLedger(tx, businessId, "PURCHASE_ORDER", purchaseOrder.id, financials.taxTransactions);

    // Update PR Status
    await tx.purchaseRequest.update({
      where: { id },
      data: { status: "CONVERTED_TO_PO" }
    });

    if (request.projectId) {
      await tx.project.update({
        where: { id: request.projectId },
        data: { committedCost: { increment: totalAmount } }
      });
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "PURCHASE_REQUEST_CONVERTED_TO_PO",
      module: "PURCHASE",
      entityType: "PurchaseRequest",
      entityId: id,
      details: { requestNumber: request.requestNumber, poId: purchaseOrder.id, poNumber }
    });

    return purchaseOrder;
  });
};

module.exports = {
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  updatePurchaseRequest,
  convertToPurchaseOrder
};
