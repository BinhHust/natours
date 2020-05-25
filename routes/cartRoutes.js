const express = require('express');

const cartController = require('../controllers/cartController');
// const authController = require('../controllers/authController');

const router = express.Router();

router.get('/addToCart/:tourId', cartController.addToCart);

module.exports = router;
