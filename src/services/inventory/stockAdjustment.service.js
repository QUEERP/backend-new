const prisma = require("../../config/prisma");
const { isTradingBusiness } = require("../../utils/businessHelper");
const { logAction } = require("../sales/audit.service");
const { createStockMovement } = require("./movement.service");
const { generateDocNumber } = require("../sales/quotation.service");
const { getSystemAccounts, postJournalEntries } = require("../ledgerService");

const getPagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const createStockAdjustment = async (businessId, userId, userEmail, data) => {
  return await prisma.$transaction(async (tx) => {
    // Generate Adjustment Number
    const adjustmentNumber = await generateDocNumber(tx, businessId, "ADJ", "stockAdjustment", "adjustmentNumber");

    const adjustment = await tx.stockAdjustment.create({
      data: {
        businessId,
        adjustmentNumber,
        warehouseId: data.warehouseId,
        locationId: data.locationId || null,
        reason: data.reason || null,
        adjustmentDate: data.adjustmentDate ? new Date(data.adjustmentDate) : new Date(),
        notes: data.notes || null,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity),
            type: item.type, // ADD or SUBTRACT
            batchNumber: item.batchNumber || null,
            serialNumbers: item.serialNumbers || []
          }))
        }
      },
      include: {
        items: true,
        warehouse: true,
        location: true
      }
    });

    // Execute stock movements for each item
    for (const item of data.items) {
      const quantityVal = item.type === "ADD" ? parseFloat(item.quantity) : -parseFloat(item.quantity);
      const movementType = item.type === "ADD" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";

      await createStockMovement(tx, {
        businessId,
        productId: item.productId,
        warehouseId: data.warehouseId,
        locationId: data.locationId || null,
        quantity: quantityVal,
        type: movementType,
        referenceType: "ADJUSTMENT",
        referenceId: adjustment.id,
        performedBy: userEmail,
        notes: `Stock adjustment: ${adjustmentNumber}. Reason: ${data.reason || 'None'}`,
        batchNumber: item.batchNumber || null,
        serialNumbers: item.serialNumbers || []
      });
    }

    // Compute total adjustment value for ledger
    let totalAdjustmentValue = 0;
    for (const item of data.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      const itemCost = product?.unitCost || product?.price || 0;
      const adjustmentValue = itemCost * parseFloat(item.quantity);
      if (item.type === "ADD") {
        totalAdjustmentValue += adjustmentValue;
      } else {
        totalAdjustmentValue -= adjustmentValue; // Net will be negative if more removals
      }
    }

    if (Math.abs(totalAdjustmentValue) > 0) {
      const accounts = await getSystemAccounts(tx, businessId);
      const journalEntries = [];
      if (totalAdjustmentValue > 0) {
        // Net increase in stock
        journalEntries.push({ businessId, accountId: accounts.SYSTEM_INVENTORY, debit: totalAdjustmentValue, credit: 0, description: `Stock Adjustment ${adjustmentNumber} (Add)` });
        journalEntries.push({ businessId, accountId: accounts.SYSTEM_STOCK_ADJUSTMENT, debit: 0, credit: totalAdjustmentValue, description: `Stock Adjustment ${adjustmentNumber} (Add)` });
      } else {
        // Net decrease in stock
        const absVal = Math.abs(totalAdjustmentValue);
        journalEntries.push({ businessId, accountId: accounts.SYSTEM_STOCK_ADJUSTMENT, debit: absVal, credit: 0, description: `Stock Adjustment ${adjustmentNumber} (Remove)` });
        journalEntries.push({ businessId, accountId: accounts.SYSTEM_INVENTORY, debit: 0, credit: absVal, description: `Stock Adjustment ${adjustmentNumber} (Remove)` });
      }
      await postJournalEntries(tx, journalEntries);
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "STOCK_ADJUSTMENT_CREATED",
      module: "INVENTORY",
      entityType: "StockAdjustment",
      entityId: adjustment.id,
      details: { adjustmentNumber, reason: data.reason }
    });

    return adjustment;
  });
};

const getStockAdjustments = async (businessId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = { businessId };

  if (query.warehouseId) {
    where.warehouseId = query.warehouseId;
  }
  if (query.search) {
    where.adjustmentNumber = { contains: query.search, mode: "insensitive" };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true }
  });
  const isTrading = isTradingBusiness(business);

  const [adjustments, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where,
      skip,
      take: limit,
      include: {
        warehouse: { select: { id: true, name: true } },
        ...(isTrading && {
          location: { select: { id: true, code: true, name: true } },
        }),
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.stockAdjustment.count({ where })
  ]);

  let finalAdjustments = adjustments;
  if (!isTrading) {
    finalAdjustments = adjustments.map(a => {
      const { locationId, ...rest } = a;
      return rest;
    });
  }

  return {
    adjustments: finalAdjustments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

const getStockAdjustmentById = async (businessId, id) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true }
  });
  const isTrading = isTradingBusiness(business);

  const adjustment = await prisma.stockAdjustment.findFirst({
    where: { id, businessId },
    include: {
      warehouse: true,
      ...(isTrading && {
        location: true,
      }),
      items: {
        include: {
          product: true
        }
      }
    }
  });

  if (!adjustment) throw new Error("Stock adjustment not found");
  
  if (!isTrading) {
    const { locationId, ...rest } = adjustment;
    return rest;
  }
  
  return adjustment;
};

module.exports = {
  createStockAdjustment,
  getStockAdjustments,
  getStockAdjustmentById
};
