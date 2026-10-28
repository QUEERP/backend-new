const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const Controller = require("../controllers/negotiationController");

// Middlewares
router.use(auth);
router.use(business);

router.get("/", Controller.getNegotiations);
router.post("/", Controller.createNegotiation);
router.get("/:id", Controller.getNegotiationById);
router.put("/:id", Controller.updateNegotiation);
router.delete("/:id", Controller.deleteNegotiation);

module.exports = router;

