const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");
const Controller = require("../controllers/warehouseController");

router.post(
  "/",
  auth,
  business,
  checkPermission("warehouse", "create"),
  Controller.createWarehouse
);

router.get(
  "/",
  auth,
  business,
  Controller.getWarehouses
);

router.put(
  "/:id",
  auth,
  business,
  checkPermission("warehouse", "update"),
  Controller.updateWarehouse
);

router.delete(
  "/:id",
  auth,
  business,
  checkPermission("warehouse", "delete"),
  Controller.deleteWarehouse
);

// Locations
router.get(
  "/:warehouseId/locations",
  auth,
  business,
  Controller.getWarehouseLocations
);

router.post(
  "/:warehouseId/locations",
  auth,
  business,
  checkPermission("warehouse", "update"),
  Controller.createWarehouseLocation
);

router.patch(
  "/locations/:locationId",
  auth,
  business,
  checkPermission("warehouse", "update"),
  Controller.updateWarehouseLocation
);

router.delete(
  "/locations/:locationId",
  auth,
  business,
  checkPermission("warehouse", "update"),
  Controller.deleteWarehouseLocation
);

module.exports = router;