const { DateTime }    = require('luxon');
const accountHelper = require('../helpers/accountHelper');
const transactionHelper = require('../helpers/transactionHelper');
const OrderServiceClientHandler = require('openfsm-order-service-client-handler')
const orderClient = new OrderServiceClientHandler();
const OrderDto = require('openfsm-order-dto');
const common       = require('openfsm-common');  /* Библиотека с общими параметрами */
const CommonFunctionHelper = require("openfsm-common-functions")
const commonFunction= new CommonFunctionHelper();
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const AccountDto = require('openfsm-account-dto');
const TransactionDto = require('openfsm-transaction-dto');
const { v4: uuidv4 } = require('uuid'); 
require('dotenv').config();


const isValidUUID = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const validateRequest = (productId, quantity, userId) => {
    if (!productId || !isValidUUID(productId)) return "Invalid product ID";
    if (!quantity || typeof quantity !== "number" || quantity <= 0) return "Invalid quantity";
    if (!userId ) return "Invalid user ID";
    return null;
};

const sendResponse = (res, statusCode, data) => {
    res.status(statusCode).json(data);
};

/*
 @input orderId - идентификатор заказа
 @output 
   200 - создан
   400 - оршибка данных
   422 - ошибка процесса
   500 - серверная ошибка
*/
exports.create = async (req, res) => {    
    let userId = await authMiddleware.getUserId(req, res);
    const {orderId, referenceId} = req.body;
    if (!userId ) return sendResponse(res, 400, { message: "Invalid user ID" }); 
    let transaction = await transactionHelper.findByReferenceId(referenceId);
    if(transaction) return sendResponse(res, 422, { message: `transactionId ${referenceId} already exists` }); 
    try {
       const order  =  await orderClient.findOrderDetailsById(commonFunction.getJwtToken(req), orderId);
        if(!order.data.orderId) throw(500);
          const account = new AccountDto(await accountHelper.create(userId)); // если счета у пользователя нет - создать
            if(!account) throw(422)
              let result = await transactionHelper.create(account.getAccountId(), 'DEPOSIT', order.data.totalAmount, referenceId); // создать транзакцию DEPOSIT - пополнение счета
              if(!result) throw(422)
               let transaction =  new TransactionDto(await transactionHelper.findByReferenceId(referenceId));
               if(!transaction) throw(422)                
               sendResponse(res, 200, { status: true,  transaction });
            } catch (error) {
            console.error("Error decline:", error);
        sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }

};


exports.decline = async (req, res) => {    
    const {deliveryOrderId} = req.body;
    if (!deliveryOrderId) throw(400);        
    try {
        const delivery = await deliveryHelper.decline(deliveryOrderId);        
        if(!delivery) throw(422)
        sendResponse(res, 200, { status: true});
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }
};
