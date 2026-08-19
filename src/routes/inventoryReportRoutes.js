const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");
const Controller = require("../controllers/inventoryReportController");

router.get(
  "/trading",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getTradingInventoryReport
);

module.exports = router;
