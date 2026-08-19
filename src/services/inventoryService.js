const prisma = require("../config/prisma");
const { isTradingBusiness } = require("../utils/businessHelper");

class InventoryService {
  /**
   * Safe Stock Increase (e.g. GRN / Purchase In / Return / Opening Adjustment)
   */
  static async increaseStock(params) {
    const client = params.tx || prisma;
    const { businessId, productId, warehouseId, locationId, quantity, type, reference = {}, performedBy, note } = params;

    if (quantity <= 0) {
      throw new Error("Quantity to increase must be positive.");
    }

    const business = await client.business.findUnique({ where: { id: businessId } });
    const isTrading = isTradingBusiness(business);
    let resolvedLocationId = isTrading ? (locationId || null) : null;

    if (isTrading && !resolvedLocationId) {
      let defaultLoc = await client.warehouseLocation.findFirst({
        where: { warehouseId, isDefault: true }
      });
      if (!defaultLoc) {
        defaultLoc = await client.warehouseLocation.create({
          data: {
            warehouseId,
            code: 'UNASSIGNED',
            name: 'Unassigned',
            isDefault: true
          }
        });
      }
      resolvedLocationId = defaultLoc.id;
    }

    let stock;
    if (isTrading && resolvedLocationId) {
      stock = await client.stock.upsert({
        where: {
          productId_warehouseId_locationId: { productId, warehouseId, locationId: resolvedLocationId }
        },
        update: {
          quantity: { increment: Number(quantity) }
        },
        create: {
          productId,
          warehouseId,
          locationId: resolvedLocationId,
          quantity: Number(quantity),
          reservedQty: 0
        }
      });
    } else {
      // Explicit findFirst check for non-trading businesses (or unassigned stock)
      const existingStock = await client.stock.findFirst({
        where: { productId, warehouseId, locationId: null }
      });
      if (existingStock) {
        stock = await client.stock.update({
          where: { id: existingStock.id },
          data: { quantity: { increment: Number(quantity) } }
        });
      } else {
        stock = await client.stock.create({
          data: {
            productId,
            warehouseId,
            locationId: null,
            quantity: Number(quantity),
            reservedQty: 0
          }
        });
      }
    }

    // 2. Log the exact movement for audit trails
    return await client.stockMovement.create({
      data: {
        businessId,
        productId,
        warehouseId,
        locationId: resolvedLocationId,
        type,
        quantity: Number(quantity),
        balanceAfter: stock.quantity,
        referenceType: reference.referenceType || (reference.purchaseOrderId ? 'PURCHASE_ORDER' : (reference.billId ? 'BILL' : (reference.grnId ? 'GRN' : null))),
        referenceId: reference.referenceId || reference.purchaseOrderId || reference.billId || reference.grnId || null,
        referenceNo: reference.referenceNo || null,
        performedBy: String(performedBy),
        notes: note || null
      }
    });
  }

  /**
   * Safe Stock Outflow (e.g. Delivery / Invoice shipment / Adjustments)
   */
  static async decreaseStock(params) {
    const client = params.tx || prisma;
    const { businessId, productId, warehouseId, locationId, quantity, type, reference = {}, performedBy, note } = params;

    if (quantity <= 0) {
      throw new Error("Quantity to decrease must be positive.");
    }

    const business = await client.business.findUnique({ where: { id: businessId } });
    const isTrading = isTradingBusiness(business);
    const resolvedLocationId = isTrading ? (locationId || null) : null;

    // Lock and retrieve stock record for safety
    const currentStock = await client.stock.findFirst({
      where: {
        productId,
        warehouseId,
        locationId: resolvedLocationId
      }
    });

    if (!currentStock || currentStock.quantity < quantity) {
      throw new Error(`Insufficient stock in warehouse for Product ID: ${productId}. Available: ${currentStock?.quantity || 0}, Requested: ${quantity}`);
    }

    const updatedStock = await client.stock.update({
      where: {
        id: currentStock.id
      },
      data: {
        quantity: { decrement: Number(quantity) }
      }
    });

    return await client.stockMovement.create({
      data: {
        businessId,
        productId,
        warehouseId,
        locationId: resolvedLocationId,
        type,
        quantity: -Number(quantity), // Outflow is a negative delta
        balanceAfter: updatedStock.quantity,
        salesOrderId: reference.salesOrderId || null,
        invoiceId: reference.invoiceId || null,
        referenceNo: reference.referenceNo || null,
        performedBy: String(performedBy),
        notes: note || null
      }
    });
  }

  /**
   * Zoho-Style Allocation: Reserve Stock during Sales Order Creation
   */
  static async reserveStock(params) {
    const client = params.tx || prisma;
    const { businessId, productId, warehouseId, locationId, quantity } = params;

    const business = await client.business.findUnique({ where: { id: businessId } });
    const isTrading = isTradingBusiness(business);
    const resolvedLocationId = isTrading ? (locationId || null) : null;

    const currentStock = await client.stock.findFirst({
      where: {
        productId,
        warehouseId,
        locationId: resolvedLocationId
      }
    });

    const available = (currentStock?.quantity || 0) - (currentStock?.reservedQty || 0);

    if (available < quantity) {
      throw new Error(`Insufficient available stock to reserve. Total physical: ${currentStock?.quantity || 0}, Reserved: ${currentStock?.reservedQty || 0}, Available: ${available}, Requested: ${quantity}`);
    }

    if (currentStock) {
      return await client.stock.update({
        where: { id: currentStock.id },
        data: { reservedQty: { increment: Number(quantity) } }
      });
    } else {
      return await client.stock.create({
        data: {
          productId,
          warehouseId,
          locationId: resolvedLocationId,
          quantity: 0,
          reservedQty: Number(quantity)
        }
      });
    }
  }

  /**
   * Release reserved stock back or deduct it during shipping
   */
  static async releaseReservation(params) {
    const client = params.tx || prisma;
    const { businessId, productId, warehouseId, locationId, quantity } = params;

    const business = await client.business.findUnique({ where: { id: businessId } });
    const isTrading = isTradingBusiness(business);
    const resolvedLocationId = isTrading ? (locationId || null) : null;

    const currentStock = await client.stock.findFirst({
      where: { productId, warehouseId, locationId: resolvedLocationId }
    });

    if (!currentStock) return null;

    return await client.stock.update({
      where: { id: currentStock.id },
      data: {
        reservedQty: { decrement: Number(quantity) }
      }
    });
  }
}

module.exports = InventoryService;
