const prisma = require("../config/prisma");
const InventoryService = require("../services/inventoryService");
const TaxEngine = require("../services/taxEngine");
const salesOrderService = require("../services/sales/salesOrder.service");
const { createSalesOrderSchema, updateSalesOrderSchema } = require("../validations/sales.validation");
const { successResponse, errorResponse } = require("../utils/response");

const VALID_STATUS = ["DRAFT", "Draft", "CONFIRMED", "Confirmed", "PROCESSING", "Processing", "FULFILLED", "Completed", "INVOICED", "Invoiced", "CANCELLED", "Cancelled", "APPROVED", "Approved", "PARTIALLY_FULFILLED"];

//////////////////////////////////////////////////////
// GENERATE ORDER NUMBER
//////////////////////////////////////////////////////
const generateOrderNumber = async (businessId) => {
  const count = await prisma.salesOrder.count({ where: { businessId } });
  return `SO-${(count + 1).toString().padStart(3, "0")}`;
};

//////////////////////////////////////////////////////
// CREATE SALES ORDER
// Keeps HEAD's rich direct-DB logic (TaxEngine + InventoryService stock reservation)
// The service-layer variant is available via salesOrderService.createSalesOrder
//////////////////////////////////////////////////////
exports.createSalesOrder = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    
    const salesOrder = await salesOrderService.createSalesOrder(businessId, userId, userEmail, req.body);
    return successResponse(res, salesOrder, "Sales Order created successfully", 201);
  } catch (error) {
    console.error("createSalesOrder controller error:", error);
    if (error.name === "ZodError" && error.errors) {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message || "Unexpected error", 400);
  }
};

//////////////////////////////////////////////////////
// CONVERT QUOTATION TO SALES ORDER
//////////////////////////////////////////////////////
exports.convertQuotation = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { quotationId } = req.params;

    const order = await salesOrderService.convertQuotationToSalesOrder(businessId, userId, userEmail, quotationId);

    return successResponse(res, order, "Quotation converted to Sales Order successfully", 201);
  } catch (error) {
    console.error("convertQuotation controller error:", error);
    return errorResponse(res, error.message, 400);
  }
};

//////////////////////////////////////////////////////
// GET ALL SALES ORDERS
//////////////////////////////////////////////////////
exports.getSalesOrders = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { customerId, status } = req.query;

    const orders = await prisma.salesOrder.findMany({
      where: {
        businessId,
        isDeleted: false,
        customerId: customerId || undefined,
        status: status || undefined
      },
      include: {
        customer: { select: { id: true, company: true } },
        items: true
      },
      orderBy: { createdAt: "desc" },
      take: 500
    });

    return successResponse(res, orders, "Sales Orders fetched successfully");
  } catch (error) {
    console.error("getSalesOrders controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// GET SALES ORDER BY ID
//////////////////////////////////////////////////////
exports.getSalesOrderById = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const order = await salesOrderService.getSalesOrderById(businessId, id);

    return successResponse(res, order, "Sales Order retrieved successfully");
  } catch (error) {
    console.error("getSalesOrderById controller error:", error);
    return errorResponse(res, error.message, 404);
  }
};

//////////////////////////////////////////////////////
// UPDATE SALES ORDER
// HEAD's rich inline logic for item recalculation + TaxEngine is preserved
//////////////////////////////////////////////////////
exports.updateSalesOrder = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { id } = req.params;

    const salesOrder = await salesOrderService.updateSalesOrder(businessId, userId, userEmail, id, req.body);
    return successResponse(res, salesOrder, "Sales Order updated successfully");
  } catch (error) {
    console.error("updateSalesOrder controller error:", error);
    if (error.name === "ZodError" && error.errors) {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message || "Unexpected error", 400);
  }
};

//////////////////////////////////////////////////////
// DELETE SALES ORDER
//////////////////////////////////////////////////////
exports.deleteSalesOrder = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { id } = req.params;

    await salesOrderService.deleteSalesOrder(businessId, userId, userEmail, id);

    return successResponse(res, null, "Sales Order deleted and stock reservation released successfully");
  } catch (error) {
    console.error("deleteSalesOrder controller error:", error);
    return errorResponse(res, error.message, 400);
  }
};

//////////////////////////////////////////////////////
// CHANGE STATUS
//////////////////////////////////////////////////////
exports.changeStatus = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return errorResponse(res, "Status is required", 400);
    }

    const order = await salesOrderService.changeStatus(businessId, userId, userEmail, id, status);

    return successResponse(res, order, "Sales Order status updated successfully");
  } catch (error) {
    console.error("changeStatus controller error:", error);
    return errorResponse(res, error.message, 400);
  }
};