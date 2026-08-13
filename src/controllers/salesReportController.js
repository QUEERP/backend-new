const reportService = require("../services/sales/report.service");
const { successResponse, errorResponse } = require("../utils/response");

exports.getSalesDashboard = async (req, res) => {
  try {
    const businessId = req.business.id;

    const data = await reportService.getSalesDashboard(businessId);

    return successResponse(res, data, "Sales dashboard report fetched successfully");
  } catch (error) {
    console.error("getSalesDashboard controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

exports.getBasicSalesReport = async (req, res) => {
  try {
    const businessId = req.business.id;
    const data = await reportService.getBasicSalesReport(businessId);
    return successResponse(res, data, "Basic sales report fetched successfully");
  } catch (error) {
    console.error("getBasicSalesReport controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};
