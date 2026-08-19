const reportService = require("../services/projectOperations/report.service");

exports.getProjectOperationsReport = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { startDate, endDate, tab, page = 1, pageSize = 25 } = req.query;
    const dateRange = startDate && endDate 
      ? { startDate, endDate }
      : null;

    const report = await reportService.getProjectOperationsReport(
      businessId, 
      dateRange,
      tab,
      parseInt(page),
      parseInt(pageSize)
    );

    res.status(200).json(report);
  } catch (error) {
    console.error("Error generating Project Operations report:", error);
    res.status(500).json({ message: "Failed to generate Project Operations report", error: error.message });
  }
};
