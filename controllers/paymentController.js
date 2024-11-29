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
 @input body - идентификатор заказа
 @output 
   200 - создан
   400 - оршибка данных
   422 - ошибка процесса
   500 - серверная ошибка
*/

exports.create = async (req, res) => {      
    const objectTransation = req.body; 
    let transaction;   
    let order;
    try {
        let userId = await authMiddleware.getUserId(req, res);
        if(!userId) throw(422)
        
        if(!objectTransation  || !objectTransation?.referenceId)  throw(400) 

        let _transaction = await transactionHelper.findByReferenceId(objectTransation.referenceId);
        if(_transaction) throw(422)
        
        let _response  =  await orderClient.findOrderByReferenceId(commonFunction.getJwtToken(req), objectTransation.referenceId);
        if(!_response?.data?.order?.orderId) throw(500);
        _response  =  await orderClient.findOrderDetailsById(commonFunction.getJwtToken(req), _response?.data?.order?.orderId);
         if(!_response?.data?.orderId) throw(500);
          order = _response?.data;
          order.deliveryId = objectTransation.deliveryId;
          objectTransation.totalAmount = order.totalAmount;
          
 
          const account = new AccountDto(await accountHelper.create(userId)); // если счета у пользователя нет - создать
         if(!account) throw(422)
             transaction = await transactionHelper.create( account.getAccountId(), transactionHelper.TRANSACTION_TYPE.DEPOSIT, objectTransation);
             if(!transaction) throw(422)     // транзакция не создалась   

             // исполнение транзакции  - синхронное обращение к процессиинговому центру, получение результата вполнения оплаты           
              let transactionResult = await transactionHelper.processing(transaction); 
              if(!transactionResult || transactionResult?.status == false) throw(402);                
              await transactionHelper.completed(transaction); // Успех оплаты                  
              await transactionHelper.executeCompletedAction({ status : true, order}); // Выполняем операции при успехе транзакции                                                                           
              sendResponse(res, 200, { status: true,  transaction });
            } catch (error) {
            console.error("Error decline:", error);         
           await transactionHelper.failed(transaction); // Ошибка оплаты 
          await transactionHelper.executeFailedAction({ status : false, order}); // Выполняем асинхронно откаты операций по саге
                                                                    // Отменяем резервирование товара
        sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }

};


exports.decline = async (req, res) => {         
    try {
        let userId = await authMiddleware.getUserId(req, res);
        if(!userId) throw(422)

        const objectTransation = req.body;
        if (!objectTransation )  throw(400)

        const order = await orderClient.findOrderDetailsById(commonFunction.getJwtToken(req), objectTransation.orderId);
        if(!order.data.orderId) throw(500);

         let transaction = await transactionHelper.create(account.getAccountId(), 'WITHDRAWAL', order.data.totalAmount, objectTransation.referenceId); // создать транзакцию WITHDRAWAL
         if(!transaction) throw(422)      
 
          let transactionResult = await transactionHelper.executeTransaction(transaction); // исполнение транзакции  - синхронное обращение к процессиинговому центру              
          if(!transactionResult) throw(402)

          const depositResult =await accountHelper.withdrawal(transaction); // списать средствасо счета
          if(!depositResult) throw(402)

          sendResponse(res, 200, { status: true,  transaction });

    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }
};
