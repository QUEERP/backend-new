const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const business = require('../middlewares/business.middleware');
const controller = require('../controllers/currencyController');

router.get('/rate', auth, business, controller.getCurrencyRate);
router.get('/master', auth, business, controller.getCurrenciesMaster);
router.post('/refresh-rates', auth, business, controller.refreshRates);
router.get('/overview', auth, business, controller.getCurrenciesOverview);
router.post('/statutory-rate', auth, business, controller.saveStatutoryRate);

module.exports = router;
