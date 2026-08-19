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
    const { dateRange } = req.query;
    const data = await reportService.getBasicSalesReport(businessId, dateRange);
    return successResponse(res, data, "Basic sales report fetched successfully");
  } catch (error) {
    console.error("getBasicSalesReport controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

exports.getTradingSalesReport = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { startDate, endDate, tab, page = 1, pageSize = 25 } = req.query;
    
    // Construct dateRange object if provided
    const dateRange = startDate && endDate ? { startDate, endDate } : null;
    
    const data = await reportService.getTradingSalesReport(
      businessId, 
      dateRange, 
      tab, 
      parseInt(page), 
      parseInt(pageSize)
    );
    return successResponse(res, data, "Trading sales report fetched successfully");
  } catch (error) {
    console.error("getTradingSalesReport controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};
