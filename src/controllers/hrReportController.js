const hrReportService = require("../services/hrReport.service");

exports.getTradingHRReport = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { startDate, endDate, tab, page = 1, pageSize = 25 } = req.query;
    const dateRange = startDate && endDate 
      ? { startDate, endDate }
      : null;

    const report = await hrReportService.getTradingHRReport(
      businessId, 
      dateRange,
      tab,
      parseInt(page),
      parseInt(pageSize)
    );

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating HR report:", error);
    res.status(500).json({ message: "Failed to generate HR report", error: error.message });
  }
};
