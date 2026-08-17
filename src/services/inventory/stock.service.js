const prisma = require("../../config/prisma");
const { isTradingBusiness } = require("../../utils/businessHelper");

const getStockLevels = async (businessId, query = {}) => {
  // Fetch business to check type
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true }
  });
  const isTrading = isTradingBusiness(business);
  const where = {
    product: { businessId, type: 'GOODS' }
  };

  if (query.productId) {
    where.productId = query.productId;
  }
  if (query.warehouseId) {
    where.warehouseId = query.warehouseId;
  }

  const stockRecords = await prisma.stock.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          costPrice: true,
          isBatchTracking: true,
          isSerialTracking: true
        }
      },
      warehouse: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      ...(isTrading && {
        location: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      })
    },
    orderBy: {
      product: { name: "asc" }
    }
  });

  // Prisma returns `locationId` on the root of the stock object, let's remove it if not trading
  if (!isTrading) {
    return stockRecords.map(record => {
      const { locationId, ...rest } = record;
      return rest;
    });
  }

  return stockRecords;
};

// ==========================================
// BATCH MANAGEMENT
// ==========================================

const getBatches = async (businessId, query = {}) => {
  const where = { businessId };

  if (query.productId) {
    where.productId = query.productId;
  }
  if (query.search) {
    where.batchNumber = { contains: query.search, mode: "insensitive" };
  }

  return await prisma.batch.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true } }
    },
    orderBy: { createdAt: "desc" }
  });
};

const getBatchById = async (businessId, id) => {
  const batch = await prisma.batch.findFirst({
    where: { id, businessId },
    include: {
      product: true,
      stockUnits: true
    }
  });

  if (!batch) throw new Error("Batch not found");
  return batch;
};

const createBatch = async (businessId, data) => {
  return await prisma.batch.create({
    data: {
      businessId,
      productId: data.productId,
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      mfgDate: data.mfgDate ? new Date(data.mfgDate) : null
    }
  });
};

// ==========================================
// SERIAL NUMBER MANAGEMENT
// ==========================================

const getSerialNumbers = async (businessId, query = {}) => {
  const where = { businessId };

  if (query.productId) {
    where.productId = query.productId;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.warehouseId) {
    where.warehouseId = query.warehouseId;
  }
  if (query.search) {
    where.serialNumber = { contains: query.search, mode: "insensitive" };
  }

  return await prisma.serialNumber.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true } },
      batch: { select: { id: true, batchNumber: true } }
    },
    orderBy: { createdAt: "desc" }
  });
};

const getSerialNumberByVal = async (businessId, serialNumber) => {
  const sn = await prisma.serialNumber.findFirst({
    where: { serialNumber, businessId },
    include: {
      product: true,
      warehouse: true,
      batch: true
    }
  });

  if (!sn) throw new Error("Serial number not found");
  return sn;
};

module.exports = {
  getStockLevels,
  getBatches,
  getBatchById,
  createBatch,
  getSerialNumbers,
  getSerialNumberByVal
};
