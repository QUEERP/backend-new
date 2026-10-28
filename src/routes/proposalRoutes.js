const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const Controller = require("../controllers/proposalController");

// Middlewares
router.use(auth);
router.use(business);

router.post("/", Controller.createProposal);
router.get("/", Controller.getProposals);
router.get("/:id", Controller.getProposalById);
router.put("/:id", Controller.updateProposal);
router.delete("/:id", Controller.deleteProposal);

router.post("/:id/approve", Controller.approveProposal);
router.post("/:id/reject", Controller.rejectProposal);
router.post("/:id/submit-approval", Controller.submitProposalApproval);
router.post("/:id/send", Controller.sendProposal);
router.get("/:id/download-pdf", Controller.downloadProposalPdf);

module.exports = router;

