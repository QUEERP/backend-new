const prisma = require("../config/prisma");
const { isTradingBusiness } = require("../utils/businessHelper");

//////////////////////////////////////////////////////
// CREATE
//////////////////////////////////////////////////////
exports.createWarehouse = async (req, res) => {
  try {
    const { name, address, city, country } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "name required",
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        address,
        city,
        country,
        businessId: req.business.id,
      },
    });

    res.status(201).json({
      success: true,
      warehouse,
    });

  } catch (error) {
    console.error("createWarehouse error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
//////////////////////////////////////////////////////
// GET ALL
//////////////////////////////////////////////////////
exports.getWarehouses = async (req, res) => {
  try {
    const data = await prisma.warehouse.findMany({
      where: { businessId: req.business.id },
    });

    res.json({ success: true, warehouses: data });
  } catch (error) {
    console.error("getWarehouses error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// UPDATE
//////////////////////////////////////////////////////
exports.updateWarehouse = async (req, res) => {
  const updated = await prisma.warehouse.updateMany({
    where: {
      id: req.params.id,
      businessId: req.business.id,
    },
    data: req.body,
  });

  if (updated.count === 0) {
    return res.status(404).json({
      success: false,
      message: "Warehouse not found",
    });
  }

  res.json({ success: true, message: "Updated" });
};

//////////////////////////////////////////////////////
// DELETE
//////////////////////////////////////////////////////
exports.deleteWarehouse = async (req, res) => {
  const deleted = await prisma.warehouse.deleteMany({
    where: {
      id: req.params.id,
      businessId: req.business.id,
    },
  });

  if (deleted.count === 0) {
    return res.status(404).json({
      success: false,
      message: "Warehouse not found",
    });
  }

  res.json({ success: true, message: "Deleted" });
};

//////////////////////////////////////////////////////
// LOCATIONS CRUD
//////////////////////////////////////////////////////

exports.getWarehouseLocations = async (req, res) => {
  try {
    if (!isTradingBusiness(req.business)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const locations = await prisma.warehouseLocation.findMany({
      where: {
        warehouseId: req.params.warehouseId,
        warehouse: { businessId: req.business.id }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createWarehouseLocation = async (req, res) => {
  try {
    if (!isTradingBusiness(req.business)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    let { code, name, locationType } = req.body;
    if (code) code = code.toUpperCase();
    
    // Verify warehouse belongs to business
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: req.params.warehouseId, businessId: req.business.id }
    });
    if (!warehouse) return res.status(404).json({ success: false, message: "Warehouse not found" });

    // Check for existing code
    const existing = await prisma.warehouseLocation.findUnique({
      where: {
        warehouseId_code: {
          warehouseId: req.params.warehouseId,
          code
        }
      }
    });
    if (existing) return res.status(400).json({ success: false, message: "Location code already exists in this warehouse" });

    const location = await prisma.warehouseLocation.create({
      data: {
        warehouseId: req.params.warehouseId,
        code,
        name,
        locationType
      }
    });
    res.status(201).json({ success: true, location });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateWarehouseLocation = async (req, res) => {
  try {
    if (!isTradingBusiness(req.business)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const { locationId } = req.params;
    let { code, name, locationType } = req.body;
    if (code) code = code.toUpperCase();

    const location = await prisma.warehouseLocation.findFirst({
      where: { id: locationId, warehouse: { businessId: req.business.id } }
    });
    if (!location) return res.status(404).json({ success: false, message: "Location not found" });

    if (code && code !== location.code) {
      const existing = await prisma.warehouseLocation.findUnique({
        where: {
          warehouseId_code: {
            warehouseId: location.warehouseId,
            code
          }
        }
      });
      if (existing) return res.status(400).json({ success: false, message: "Location code already exists in this warehouse" });
    }

    const updated = await prisma.warehouseLocation.update({
      where: { id: locationId },
      data: {
        code,
        name,
        locationType
      }
    });

    res.json({ success: true, location: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteWarehouseLocation = async (req, res) => {
  try {
    if (!isTradingBusiness(req.business)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const { locationId } = req.params;

    const location = await prisma.warehouseLocation.findFirst({
      where: { id: locationId, warehouse: { businessId: req.business.id } }
    });
    if (!location) return res.status(404).json({ success: false, message: "Location not found" });

    if (location.isDefault) {
      return res.status(409).json({ success: false, message: "Cannot delete the default location" });
    }

    const activeStock = await prisma.stock.findFirst({
      where: { locationId, quantity: { gt: 0 } }
    });
    
    if (activeStock) {
      return res.status(409).json({ success: false, message: "Cannot delete location with existing stock" });
    }

    await prisma.warehouseLocation.delete({
      where: { id: locationId }
    });

    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};