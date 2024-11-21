const express = require('express');
const 
router = express.Router();
const common = require("openfsm-common"); /* Библиотека с общими параметрами */
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const payment = require('../controllers/paymentController');


router.post('/v1/create', authMiddleware.authenticateToken, payment.create);  // Создать пополнение
router.post('/v1/decline', authMiddleware.authenticateToken, payment.decline);  // Отменить пополнение  счета


module.exports = router;
