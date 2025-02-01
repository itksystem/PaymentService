const express = require('express');
router = express.Router();
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const payment = require('../controllers/paymentController');


router.post('/v1/create', authMiddleware.authenticateToken, payment.create);  // Создать пополнение
router.post('/v1/decline', authMiddleware.authenticateToken, payment.decline);  // Отменить пополнение  счета

router.get('/v1/instrumets', authMiddleware.authenticateToken, payment.instruments);  // Получить набор инструментов
router.get('/v1/cards', authMiddleware.authenticateToken, payment.cards);  // Получить набор инструментов


module.exports = router;
