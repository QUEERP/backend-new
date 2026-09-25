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

// Find exports.createSalesOrder and exports.convertQuotation
const createStartIndex = content.indexOf('exports.createSalesOrder = async');
const convertStartIndex = content.indexOf('exports.convertQuotation = async');

if (createStartIndex !== -1 && convertStartIndex !== -1) {
  content = content.substring(0, createStartIndex) + newCreateSalesOrder + '\n\n//////////////////////////////////////////////////////\n// CONVERT QUOTATION TO SALES ORDER\n//////////////////////////////////////////////////////\n' + content.substring(convertStartIndex);
} else {
  console.log('Failed to find create bounds');
}

// Find exports.updateSalesOrder and exports.deleteSalesOrder
const updateStartIndex = content.indexOf('exports.updateSalesOrder = async');
const deleteStartIndex = content.indexOf('exports.deleteSalesOrder = async');

if (updateStartIndex !== -1 && deleteStartIndex !== -1) {
  content = content.substring(0, updateStartIndex) + newUpdateSalesOrder + '\n\n//////////////////////////////////////////////////////\n// DELETE SALES ORDER\n//////////////////////////////////////////////////////\n' + content.substring(deleteStartIndex);
} else {
  console.log('Failed to find update bounds');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done replacement!');
