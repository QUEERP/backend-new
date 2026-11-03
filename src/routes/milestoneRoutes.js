const express = require("express");
const router = express.Router();
const Controller = require("../controllers/projectOperationsController");
const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");

router.use(auth);
router.use(business);

// Literal endpoints must come BEFORE any parameterized /:id route
router.get("/next-code", checkPermission("Milestones", "view"), Controller.getNextMilestoneCode);
router.get("/form-options", checkPermission("Milestones", "view"), Controller.getMilestoneFormOptions);

// List and Create
router.get("/", checkPermission("Milestones", "view"), Controller.getGlobalMilestones);
router.post("/", checkPermission("Milestones", "create"), Controller.createMilestone);

// Parameterized item toggle and approve
router.post("/:id/items/:itemId/toggle", checkPermission("Milestones", "edit"), Controller.toggleMilestoneItem);
router.post("/:id/approve", checkPermission("Milestones", "approve"), Controller.approveMilestone);

// Parameterized Milestone by ID
router.get("/:id", checkPermission("Milestones", "view"), Controller.getMilestoneById);
router.put("/:id", checkPermission("Milestones", "edit"), Controller.updateMilestone);
router.delete("/:id", checkPermission("Milestones", "delete"), Controller.deleteMilestone);

module.exports = router;
