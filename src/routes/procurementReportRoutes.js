const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");
const controller = require("../controllers/procurementReportController");

router.get(
  "/trading",
  auth,
  businessMiddleware,
  checkPermission("purchase_order", "read"), // Basic permission check
  controller.getTradingProcurementReport
);

module.exports = router;
