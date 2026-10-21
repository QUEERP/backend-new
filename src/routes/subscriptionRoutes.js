const express = require("express");

const controller = require("../controllers/subscriptionController");
const authMiddleware = require("../middlewares/authMiddleware");
const requireSubscriptionAdmin = require("../middlewares/subscriptionAdminMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.use(requireSubscriptionAdmin);

router.get("/subscription", controller.getSubscription);
router.post("/activate", authMiddleware, controller.activateSubscription);
router.post("/extend", controller.extendSubscription);
router.post("/update-plan", controller.updatePlan);
router.post("/deactivate", controller.deactivateSubscription);
router.get("/all", controller.getAllSubscriptions);
router.get("/stats", controller.getSubscriptionStats);
router.get("/businesses", controller.getBusinesses);
router.post("/businesses/toggle-status", controller.toggleBusinessStatus);
router.post("/businesses/allocate-modules", controller.allocateModules);
router.get("/users", controller.getUsers);
router.post("/users/toggle-status", controller.toggleUserStatus);
router.post("/users/create", controller.createUser);
router.get("/permissions", controller.getPermissions);

module.exports = router;
