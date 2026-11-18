const express = require("express");
const router = express.Router();
const contactSalesController = require("../controllers/contactSalesController");

// Public route for landing page sales & pricing inquiries
router.post("/", contactSalesController.submitSalesInquiry);

module.exports = router;

