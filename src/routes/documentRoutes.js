const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const checkBusinessSubscription = require("../middlewares/subscriptionMiddleware");

// MOCK GET DOCUMENTS
router.get(
  "/",
  authMiddleware,
  businessMiddleware,
  checkBusinessSubscription,
  (req, res) => {
    res.json({
      success: true,
      documents: [],
      totalCount: 0
    });
  }
);

module.exports = router;
