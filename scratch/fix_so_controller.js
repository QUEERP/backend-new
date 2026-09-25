const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/salesorderController.js';
let content = fs.readFileSync(path, 'utf8');

const newCreateSalesOrder = `exports.createSalesOrder = async (req, res) => {
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
};`;

const newUpdateSalesOrder = `exports.updateSalesOrder = async (req, res) => {
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
};`;

// Replace createSalesOrder
content = content.replace(/exports\.createSalesOrder = async \(req, res\) => \{[\s\S]*?(?=\n\n\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ UPDATE SALES ORDER)/, newCreateSalesOrder);

// Replace updateSalesOrder
content = content.replace(/exports\.updateSalesOrder = async \(req, res\) => \{[\s\S]*?(?=\n\n\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ GET ALL SALES ORDERS)/, newUpdateSalesOrder);

fs.writeFileSync(path, content, 'utf8');
console.log('Replaced createSalesOrder and updateSalesOrder');
