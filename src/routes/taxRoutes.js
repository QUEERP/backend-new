const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const taxController = require("../controllers/taxController");

// Endpoint for debounced tax resolution preview
router.post("/resolve", authMiddleware, businessMiddleware, taxController.resolveTaxPreview);

// Endpoint for single-source-of-truth statutory supply type determination
router.get("/supply-type", authMiddleware, businessMiddleware, taxController.getSupplyType);

// Endpoint for statutory 36 Indian States and GST codes
router.get("/gst-states", authMiddleware, taxController.getGstStates);

module.exports = router;
