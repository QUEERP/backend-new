const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/salesorderController.js';
let content = fs.readFileSync(path, 'utf8');

const newCreateSalesOrder = `//////////////////////////////////////////////////////
// CREATE SALES ORDER
//////////////////////////////////////////////////////
exports.createSalesOrder = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    
    const order = await salesOrderService.createSalesOrder(businessId, userId, userEmail, req.body);

    return successResponse(res, order, "Sales Order created successfully and stock reserved", 201);
  } catch (error) {
    console.error("createSalesOrder error:", error);
    if (error.name === "ZodError") {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message, 400);
  }
};`;

const newUpdateSalesOrder = `//////////////////////////////////////////////////////
// UPDATE SALES ORDER
//////////////////////////////////////////////////////
exports.updateSalesOrder = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { id } = req.params;

    const result = await salesOrderService.updateSalesOrder(businessId, userId, userEmail, id, req.body);

    return successResponse(res, result, "Sales Order updated successfully");
  } catch (error) {
    console.error("updateSalesOrder controller error:", error);
    if (error.name === "ZodError") {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message, 400);
  }
};`;

// Regex to match createSalesOrder
content = content.replace(/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ CREATE SALES ORDER[\s\S]*?(?=\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ CONVERT QUOTATION TO SALES ORDER)/, newCreateSalesOrder + '\n\n');

// Regex to match updateSalesOrder
content = content.replace(/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ UPDATE SALES ORDER[\s\S]*?(?=\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ DELETE SALES ORDER)/, newUpdateSalesOrder + '\n\n');

fs.writeFileSync(path, content, 'utf8');
console.log('Replaced createSalesOrder and updateSalesOrder');
