const express = require('express');
router = express.Router();
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const payment = require('../controllers/paymentController');


// счет создаем через обращение к шине
// router.post('/v1/create', authMiddleware.authenticateToken, payment.create);  // Создать пополнение
// 
// router.post('/v1/decline', authMiddleware.authenticateToken, payment.decline);  // Отменить пополнение  счета

// Все операции с платежными транзакциями только через шину 
// Через API доступны только справочники и управление ими

router.post(     '/v1/transaction-success-hook', payment.successHook);  // Получить набор инструментов
router.post(     '/v1/transaction-failed-hook',  payment.failedHook);  // Получить набор инструментов
router.post(     '/v1/create',  payment.create);  // Получить набор инструментов

//
router.get(     '/v1/instruments', authMiddleware.authenticateToken, payment.instruments);  // Получить набор инструментов
router.get(     '/v1/cards', authMiddleware.authenticateToken, payment.cards);  // Получить набор инструментов
router.patch(   '/v1/card', authMiddleware.authenticateToken, payment.setDefaultCard);  // Получить набор инструментов
router.delete(  '/v1/card', authMiddleware.authenticateToken, payment.deleteCard);  // Получить набор инструментов


module.exports = router;
