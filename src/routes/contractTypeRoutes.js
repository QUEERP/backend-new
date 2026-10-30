const router = require("express").Router();

const authMiddleware = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");

const {
  createContractType,
  getContractTypes,
  deleteContractType
} = require("../controllers/contractTypeController");

//////////////////////////////////////////////////////
// CREATE TYPE
//////////////////////////////////////////////////////
router.post(
  "/",
  authMiddleware,
  businessMiddleware,
  checkPermission("contract", "create"),
  createContractType
);

//////////////////////////////////////////////////////
// GET TYPES
//////////////////////////////////////////////////////
router.get(
  "/",
  authMiddleware,
  businessMiddleware,
  checkPermission("contract", "read"),
  getContractTypes
);

//////////////////////////////////////////////////////
// DELETE TYPE
//////////////////////////////////////////////////////
router.delete(
  "/:id",
  authMiddleware,
  businessMiddleware,
  checkPermission("contract", "delete"),
  deleteContractType
);

module.exports = router;
