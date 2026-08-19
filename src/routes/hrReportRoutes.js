const express = require("express");
const router = express.Router();
const hrReportController = require("../controllers/hrReportController");
const authMiddleware = require("../middlewares/authMiddleware");

// Both GET and POST support for flexibility, but frontend generally uses GET with query params
router.get("/trading", authMiddleware, hrReportController.getTradingHRReport);

module.exports = router;
