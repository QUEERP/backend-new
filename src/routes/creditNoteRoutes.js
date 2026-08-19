const router = require("express").Router();

const controller = require("../controllers/creditNoteController");

const auth = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");
const creditNoteAccess = require("../middlewares/creditNoteAccess");

//////////////////////////////////////////////////////
// OWNER → VIEW ALL CREDIT NOTES
//////////////////////////////////////////////////////
router.get(
  "/",
  auth,
  businessMiddleware,
  controller.getAllCreditNotes
);

//////////////////////////////////////////////////////
// CREATE CREDIT NOTE
//////////////////////////////////////////////////////
router.post(
  "/",
  auth,
  businessMiddleware,
  controller.createCreditNote
);

//////////////////////////////////////////////////////
// VIEW SINGLE CREDIT NOTE
//////////////////////////////////////////////////////
router.get(
  "/:id",
  auth,
  businessMiddleware,
  creditNoteAccess,
  controller.getCreditNote
);

//////////////////////////////////////////////////////
// VOID/DELETE CREDIT NOTE
//////////////////////////////////////////////////////
router.delete(
  "/:id",
  auth,
  businessMiddleware,
  controller.deleteCreditNote
);

router.get(
  "/:id/download",
  auth,
  businessMiddleware,
  controller.downloadCreditNotePdf
);

//////////////////////////////////////////////////////
// APPLY / REFUND CREDIT NOTE
//////////////////////////////////////////////////////
router.post(
  "/:id/apply",
  auth,
  businessMiddleware,
  controller.applyCreditNote
);

router.post(
  "/:id/refund",
  auth,
  businessMiddleware,
  controller.refundCreditNote
);

module.exports = router;