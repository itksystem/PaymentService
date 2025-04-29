const amqp = require('amqplib');
const db = require('openfsm-database-connection-producer');
const { v4: uuidv4 } = require('uuid'); // Убедитесь, что установлен uuid версии 8
const ClientProducerAMQP = require('openfsm-client-producer-amqp'); 
const SQL        = require('common-payment-service').SQL;
const MESSAGES   = require('common-payment-service').MESSAGES;
const accountHelper = require('../helpers/accountHelper');

if (!ClientProducerAMQP) {
  throw new Error('ClientProducerAMQP is not defined');
}
require('dotenv').config({ path: '.env-payment-service' });

const { 
  RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD, 
  RABBITMQ_PAYMENT_TRANSACTION_QUEUE

} = process.env;
const login = RABBITMQ_USER || 'guest';
const pwd   = RABBITMQ_PASSWORD || 'guest';
const host  = RABBITMQ_HOST || 'rabbitmq-service';
const port  = RABBITMQ_PORT || '5672';

// Транзакции
const PAYMENT_TRANSACTION  = RABBITMQ_PAYMENT_TRANSACTION_QUEUE || 'PAYMENT_TRANSACTION'; // очередь для работы с транзациями

exports.TRANSACTION_TYPE = {
  DEPOSIT:    "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  RETURN:     "RETURN",
};

exports.TRANSACTION_STATUS = {
  PENDING:   "PENDING",    // В ожидании
  COMPLETED: "COMPLETED", // Завершено
  FAILED:    "FAILED"       // Ошибка
};

const TRANSACTION_STATUS = exports.TRANSACTION_STATUS;
const TRANSACTION_TYPE = exports.TRANSACTION_TYPE;

 /* найти по referency_id ттранзакции */
 exports.findByReferenceId = (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM  pa_payment_service.transactions WHERE reference_id = $1';
      db.query(sql, [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result?.rows[0] ?? null));
      });
    });
  };

   /* найти по id ттранзакции */
 exports.findById = (id) => {
    return new Promise((resolve, reject) => {      
      db.query('SELECT * FROM  pa_payment_service.transactions WHERE transaction_id = $1', [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result?.rows[0] ?? null));
      });
    });
  };

   /* найти все транзакции по счету */
 exports.findByAccountId = (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM  pa_payment_service.transactions WHERE account_id = $1';
      db.query(sql, [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result?.rows[0] ?? null));
      });
    });
  };


// обновление статуса транзакции или ее создание
exports.transaction = async (msg) => {
  const {accountId, amount, type, status, transactionId, referenceId, processMessage, processCode, processCharCode} = msg;
  console.log(`exports.transaction =>`, msg);
  if(!accountId || !amount || !type || !status || !transactionId) {    
    return null;
  }
  return new Promise( async(resolve, reject) => {      
      db.query(SQL.TRANSACTION.UPSERT, 
        [accountId, amount, type, status, transactionId, referenceId, processMessage, processCode, processCharCode], (err, result) => {
        (err)
        ? reject(err)
        : resolve(result?.rows[0] ?? null);
      });
    });
};


// процесс формирования подписки на услуги - создание транзакции
exports.create = async (accountId=null, amount=null, type=nul, referenceId=null ) => {
    try {
          let rabbitClient = new ClientProducerAMQP();      
          let result = await  rabbitClient.sendMessage(PAYMENT_TRANSACTION , {accountId, amount, type, referenceId})  
          if(!result) throw(`transactionHelper#exports.create error!`)
          return {accountId, amount, type, referenceId};  
        } catch (error) {
          console.log(error);
          return null;
    }
};



exports.hook = async (msg, status) => {
  try {       
       if (status !== TRANSACTION_STATUS.COMPLETED 
            && status !== TRANSACTION_STATUS.FAILED 
              && status !== TRANSACTION_STATUS.PENDING) 
              throw(`status=${status}  FAILED STATUS!`)

        if (!msg.referenceId) 
          throw(`Hook referenceId error `)

        let transaction = await exports.findByReferenceId(msg.referenceId);
        if (!transaction.account_id) 
          throw(`Hook transaction error`)

        let account = await accountHelper.findByAccountId(transaction.account_id);
        if (!account.account_id 
              || (transaction.account_id == account.account_id )) 
                  throw(`Hook account_id error`)
          msg.status = status;
          msg.userId = account.user_id ?? null;
          msg.amount = transaction.amount ?? null;
          msg.type = transaction.type ?? null;
          msg.transactionId = transaction.transaction_id ?? null;            

         let rabbitClient = new ClientProducerAMQP();      
         let result = await  rabbitClient.sendMessage(PAYMENT_TRANSACTION , msg)  
         if(!result) 
           throw(`transactionHelper#exports.create error!`);
        return msg;  

      } catch (error) {
          console.log(error);
        return null;
  }
};


// Подключение к RabbitMQ и прослушивание очереди
  async function startConsumer(queue, handler) {
    try {
       const connection = await amqp.connect(`amqp://${login}:${pwd}@${host}:${port}`);
       const channel = await connection.createChannel();
       await channel.assertQueue(queue, { durable: true });
       console.log(`Listening on queue ${queue}...`);
       channel.consume(queue, async (msg) => {
          if (msg) {
             try {
                const data = JSON.parse(msg.content.toString());
                await handler(data);
                channel.ack(msg);
             } catch (error) {
                 console.error(`Error processing message: ${error}`);
                 channel.ack(msg);
              }
            }
          });
        } catch (error) {
            
            console.error(`Error connecting to RabbitMQ: ${error}`);
     }
  }
 
/* Модель для кредитования баланса счета пользователя
   {
  "userId": 14,
  "amount": 1234,
  "type": "DEPOSIT",
  "status": "PENDING",
  "transactionId": "d415ac44-d7cf-4f3f-801c-325219398b78",
  "referenceId": "d415ac44-d7cf-4f3f-801c-325219398b78"
}
*/

startConsumer(PAYMENT_TRANSACTION,
  async (msg) => {
    try {
      if (!msg?.userId || !msg?.amount || !msg?.type || !msg?.status ) 
        throw(`msg?.userId=${msg?.userId} msg?.amount=${msg?.amount} msg?.type=${msg?.type} msg?.status=${msg?.status}`)

      let account = await accountHelper.findByUserId(msg?.userId)                    
      if (!account.account_id) 
        throw(`accountId=${account.account_id}  FAILED accountId!`)  
                  
      if (msg.type !== TRANSACTION_TYPE.DEPOSIT 
            && msg.type !== TRANSACTION_TYPE.WITHDRAWAL  
              && msg.type !== TRANSACTION_TYPE.RETURN) 
                  throw(`msg.type=${msg.type}  FAILED TYPE!`)  

      if (msg.status !== TRANSACTION_STATUS.COMPLETED 
              && msg.status !== TRANSACTION_STATUS.FAILED 
                && msg.status !== TRANSACTION_STATUS.PENDING) 
                  throw(`msg.status=${msg.status}  FAILED STATUS!`)

      if (!msg?.referenceId)  
                  throw(`msg?.referenceId=${msg?.referenceId}  FAILED referenceId!`)
      if (!msg?.referenceId && !msg?.transactionId)  
                  throw(`not msg?.referenceId && msg?.transactionId!`)

      msg.referenceId   = msg?.referenceId;       // получаем идентификатор иденпотености запроса referenceId, приходит с фронта
      msg.accountId     = account.account_id;
      msg.transactionId = msg?.transactionId ?? uuidv4(); // создаем новую транзацию или указываем текущую      
      msg.amount        = msg?.amount;

      let _transaction =  await exports.findByReferenceId(msg.referenceId); // ищем ранее сформированную транзакцию по  идентификатору иденпотености запроса referenceId
      if(_transaction?.transaction_id 
            && _transaction?.transaction_id !== msg.transactionId) 
                  throw(`Транзакция была ранее выполнена в рамках другого запроса `)

      if(_transaction?.status == msg.status ||
          _transaction?.status == TRANSACTION_STATUS.COMPLETED  ||
            _transaction?.status == TRANSACTION_STATUS.FAILED) 
                  throw(`Транзакция уже имела статус ${_transaction?.status} или была завершена...`);

      let transaction = await exports.transaction(msg);

      if(transaction && msg.status == TRANSACTION_STATUS.COMPLETED) { // обновляем баланс при успешном выполнении транзакции
         switch(msg.type){
          case TRANSACTION_TYPE.DEPOSIT :
          case TRANSACTION_TYPE.WITHDRAWAL : {
            let balance = accountHelper.updateBalance(msg.accountId); 
            if(!balance) throw(`Account balance failed`)
            break;
          }
        }
      }        

    } catch (error) {
      console.log(`startConsumer[${PAYMENT_TRANSACTION}] =>`, error, msg);
  }
 } 
);  

