const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");
const controller = require("../controllers/projectOperationsReportController");

// The base path in app.js will be /api/project-operations-reports
router.get("/", auth, businessMiddleware, controller.getProjectOperationsReport);

module.exports = router;
