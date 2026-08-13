const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");
const controller = require("../controllers/paymentController");

//////////////////////////////////////////////////
// CREATE PAYMENT (INVOICE - OLD)
//////////////////////////////////////////////////
router.post(
  "/:invoiceId",
  auth,
  business,
  checkPermission("payment", "create"),
  controller.createPayment
);

//////////////////////////////////////////////////
// 🔥 CREATE PAYMENT (BILL - NEW)
//////////////////////////////////////////////////
router.post(
  "/bill/:billId",
  auth,
  business,
  checkPermission("payment", "create"),
  controller.createPayment
);

//////////////////////////////////////////////////
// 🔥 CREATE PAYMENT (QUOTATION)
//////////////////////////////////////////////////
router.post(
  "/quotation/:quotationId",
  auth,
  business,
  checkPermission("payment", "create"),
  controller.createPayment
);

//////////////////////////////////////////////////
// 🔥 CREATE PAYMENT (CUSTOMER ADVANCE / UNASSIGNED)
//////////////////////////////////////////////////
router.post(
  "/customer/:customerId",
  auth,
  business,
  checkPermission("payment", "create"),
  controller.createPayment
);

//////////////////////////////////////////////////
// 🔥 CREATE PAYMENT (PROJECT)
//////////////////////////////////////////////////
router.post(
  "/project/:projectId",
  auth,
  business,
  checkPermission("payment", "create"),
  controller.createPayment
);

//////////////////////////////////////////////////
// GET ALL PAYMENTS
//////////////////////////////////////////////////
router.get(
  "/",
  auth,
  business,
  checkPermission("payment", "read"),
  controller.getPayments
);

//////////////////////////////////////////////////
// READ PAYMENTS BY INVOICE
//////////////////////////////////////////////////
router.get(
  "/invoice/:invoiceId",   // ✅ FIXED (no conflict)
  auth,
  business,
  checkPermission("payment", "read"),
  controller.getInvoicePayments
);

//////////////////////////////////////////////////
// READ PAYMENTS BY QUOTATION
//////////////////////////////////////////////////
router.get(
  "/quotation/:quotationId",
  auth,
  business,
  checkPermission("payment", "read"),
  controller.getQuotationPayments
);

//////////////////////////////////////////////////
// READ PAYMENTS BY PROJECT
//////////////////////////////////////////////////
router.get(
  "/project/:projectId",
  auth,
  business,
  checkPermission("payment", "read"),
  controller.getProjectPayments
);

//////////////////////////////////////////////////
// DOWNLOAD PAYMENT PDF
//////////////////////////////////////////////////
router.get(
  "/download/:paymentId",   // ✅ FIXED (no conflict)
  auth,
  business,
  checkPermission("payment", "read"),
  controller.downloadPaymentPdf
);

//////////////////////////////////////////////////
// PAYMENT ALLOCATION ENDPOINTS
//////////////////////////////////////////////////
router.get(
  "/details/:paymentId",
  auth,
  business,
  checkPermission("payment", "read"),
  controller.getPaymentDetails
);

router.post(
  "/:paymentId/allocate-new-invoice",
  auth,
  business,
  checkPermission("payment", "create"),
  controller.allocateNewInvoice
);

router.post(
  "/:paymentId/allocate-existing-invoice",
  auth,
  business,
  checkPermission("payment", "create"),
  controller.allocateExistingInvoice
);

module.exports = router;