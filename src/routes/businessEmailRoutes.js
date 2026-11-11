const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const businessEmailController = require("../controllers/businessEmailController");

// All business email routes require authentication and business context
router.use(authMiddleware);
router.use(businessMiddleware);

// GET /api/business-email - Get business email configuration
router.get("/", businessEmailController.getConfig);

// POST /api/business-email - Save or update business email configuration
router.post("/", businessEmailController.saveConfig);

// POST /api/business-email/test - Test connection and send verification email
router.post("/test", businessEmailController.testConfig);

// PATCH /api/business-email/toggle - Enable or disable business email
router.patch("/toggle", businessEmailController.toggleStatus);

// POST /api/business-email/send - Send business email (Invoices, Reminders, POs, HR)
router.post("/send", businessEmailController.sendEmail);

module.exports = router;

