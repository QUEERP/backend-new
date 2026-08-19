const tradingReportService = require("../services/purchase/tradingReport.service");
const { successResponse, errorResponse } = require("../utils/response");

exports.getTradingProcurementReport = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { startDate, endDate, tab, page = 1, pageSize = 25 } = req.query;
    
    // Construct dateRange object if provided
    const dateRange = startDate && endDate ? { startDate, endDate } : null;
    
    const data = await tradingReportService.getTradingProcurementReport(
      businessId, 
      dateRange, 
      tab, 
      parseInt(page), 
      parseInt(pageSize)
    );
    
    return successResponse(res, data, "Trading procurement report fetched successfully");
  } catch (error) {
    console.error("getTradingProcurementReport controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};
