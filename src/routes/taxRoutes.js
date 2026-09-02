const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const taxController = require("../controllers/taxController");

// Endpoint for debounced tax resolution preview
router.post("/resolve", authMiddleware, businessMiddleware, taxController.resolveTaxPreview);

module.exports = router;
