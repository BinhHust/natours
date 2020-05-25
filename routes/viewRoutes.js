const express = require('express');

const viewController = require('../controllers/viewController');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/me', authController.protect, viewController.getAccount);
router.get('/', authController.isLogIn, viewController.getOverview);
router.get('/tour/:slug', authController.isLogIn, viewController.getTour);
router.get('/login', authController.isLogIn, viewController.getLoginForm);

module.exports = router;
