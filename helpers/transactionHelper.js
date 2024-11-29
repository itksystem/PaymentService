const amqp = require('amqplib');
const db = require('openfsm-database-connection-producer');
const { v4: uuidv4 } = require('uuid'); // Убедитесь, что установлен uuid версии 8
const ClientProducerAMQP = require('openfsm-client-producer-amqp'); 
if (!ClientProducerAMQP) {
  throw new Error('ClientProducerAMQP is not defined');
}
require('dotenv').config();

const { RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_PAYMENT_SUCCESS_ACTION_QUEUE,  
  DELIVERY_RESERVATION_QUEUE,
  WAREHOUSE_RESERVATION_QUEUE,
  RABBITMQ_PAYMENT_FAILED_ACTION_QUEUE} = process.env;
const login = RABBITMQ_USER || 'guest';
const pwd = RABBITMQ_PASSWORD || 'guest';
const DELIVERY_RESERVATION = DELIVERY_RESERVATION_QUEUE || 'DELIVERY_RESERVATION';
const WAREHOUSE_RESERVATION = WAREHOUSE_RESERVATION_QUEUE || 'WAREHOUSE_RESERVATION';
const failed_queue = RABBITMQ_PAYMENT_FAILED_ACTION_QUEUE || 'ORDER_STATUS';
const host = RABBITMQ_HOST || 'rabbitmq-service';
const port = RABBITMQ_PORT || '5672';

console.log(process.env);

exports.TRANSACTION_TYPE = {
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL"
};

exports.TRANSACTION_STATUS = {
  PENDING: "PENDING",    // В ожидании
  COMPLETED: "COMPLETED", // Завершено
  FAILED: "FAILED"       // Ошибка
};


 /* найти по referency_id ттранзакции */
 exports.findByReferenceId = (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM  transactions WHERE reference_id = ?';
      db.query(sql, [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result[0] != undefined ? result[0]: null));
      });
    });
  };

   /* найти по id ттранзакции */
 exports.findById = (id) => {
    return new Promise((resolve, reject) => {      
      db.query('SELECT * FROM  transactions WHERE transaction_id = ?', [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result[0] != undefined ? result[0]: null));
      });
    });
  };

   /* найти все транзакции по счету */
 exports.findByAccountId = (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM  transactions WHERE account_id = ?';
      db.query(sql, [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result? result: null));
      });
    });
  };



/*
 создать транзакцию
.create(account.getAccountId(), TRANSACTION_TYPE.DEPOSIT, objectTransation);
@accountId - Идентификатор счета 
@transactionType - тип операции
@objectTransation - транзакционнный обьект
@output- 
*/     
  exports.create = (accountId, transactionType,  objectTransation) => {
      return new Promise((resolve, reject) => {
        if (!objectTransation || !accountId || !transactionType) return reject(null);       
        if (!objectTransation.referenceId || !objectTransation.totalAmount  ) return reject(null);       
    
        const sql = `INSERT INTO transactions (account_id, transaction_type, amount, reference_id) VALUES (?, ?, ?, ?)`;
        db.query(sql, [
          accountId, 
          transactionType, 
          objectTransation.totalAmount, 
          objectTransation.referenceId        
        ], (err, result) => {
          if (err) {
            return reject(null); // Обработка ошибки
          }
          // Возврат результата findById
          exports.findByReferenceId(objectTransation.referenceId)
            .then((transaction) => {
              transaction.paymentDetails = objectTransation.paymentDetails;
              resolve(transaction)
            }) // Разрешение промиса с найденной транзакцией
            .catch(findError => reject(null)); // Обработка ошибки findById
        });
      });
    };


       /* создать транзакцию 'RETURN' - возврат  */
 exports.return = (referenceId) => {
    return new Promise( async(resolve, reject) => {        
        const transaction = await exports.findByReferenceId(referenceId); // получили данные откатываемой транзакции, создаем новую транзакцию - возврат
        const returnReferenceId  = uuidv4();     
        const sql = `INSERT INTO transactions (account_id, transaction_type, status, amount, reference_id) VALUES (?, ?, ?, ?, ?)`;
        db.query(sql, [transaction.account_id, 'RETURN','PENDING', transaction.amount, returnReferenceId], (err, result) => {
          (err)
          ? reject(err)
          : resolve(result.insertId != undefined ? result.insertId: null);
        });
      });
    };
  

  
    /* Выполнение синхронной операции оплаты в процессинговом центре */
    /* ЗАГЛУШКА */
    exports.processing = (transaction) => {
     // вернули идентификатор успешной операции
      if(transaction.paymentDetails.SecureCode == '111') {
        return {status : true, processingId : uuidv4(), referenceId : transaction.referenceId} // УСПЕХ
       } else
       return {status : false, processingId : uuidv4(), referenceId : transaction.referenceId};  // НЕВЕРНО ВВЕДЕН КОД
    };

  /* транзакция успешна */
    exports.completed = (transaction) => {
      return new Promise((resolve, reject) => {
       const sql = `UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE reference_id = ?`;
       db.query(sql, [
        exports.TRANSACTION_STATUS.COMPLETED,
        transaction.reference_id
        ], (err, result) => {
         (err)
          ? reject(err)
          : resolve(result.affectedRows > 0 ? result.affectedRows : null); 
         });
       });
     };
    
    /* транзакция неуспешна */
   exports.failed = (transaction) => {
    if(!transaction || !transaction?.reference_id) return null;
     return new Promise((resolve, reject) => {
      const sql = `UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE 1=1
      AND status = ?
      AND reference_id = ?`;
      db.query(sql, [
        exports.TRANSACTION_STATUS.FAILED,
        exports.TRANSACTION_STATUS.PENDING,
        transaction.reference_id
      ], (err, result) => {
        (err)
         ? reject(err)
         : resolve(result.affectedRows > 0 ? result.affectedRows : null); 
        });
      });
    };

    
/* Отправка команды от откат операций бронирования товара  */
   exports.executeCompletedAction = async (order) => {
    try {
      let rabbitClient = new ClientProducerAMQP();
      await  rabbitClient.sendMessage(DELIVERY_RESERVATION, order )  
      rabbitClient = new ClientProducerAMQP();
      await  rabbitClient.sendMessage(WAREHOUSE_RESERVATION, order )  
      } catch (error) {            
     throw(error)
    }
   };

  /* Отправка команды от откат операций бронирования товара  */
  exports.executeFailedAction = async (order) => {
    try {
      const rabbitClient = new ClientProducerAMQP();
      await  rabbitClient.sendMessage(failed_queue, order )  
   } catch (error) {            
     throw(error)
   }
  }; 

  // Основная функция для обработки сообщения из очереди
async function messageConsumer(msg) {
  try {
      let message = msg.content.toString();
      const messageContent = JSON.parse(message);
      const { route, template, to, subject, text, variables } = messageContent;     
  } catch (error) {
      console.log(`Ошибка ${error}...`);
  } 
}

// Подключение к RabbitMQ и прослушивание очереди
async function startConsumer(queue) {
  try {        
      const connection = await amqp.connect(`amqp://${login}:${pwd}@${host}:${port}`);
      const channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });
      console.log(`Ожидание сообщений в очереди ${queue}...`);

      channel.consume(queue, async (msg) => {
          if (msg !== null) {
              await messageConsumer(msg);
              channel.ack(msg); // Подтверждение обработки сообщения
          }
      });
  } catch (error) {
      console.error(`Ошибка подключения к RabbitMQ: ${error}`);
  }
}

// startConsumer();

/*
deposit - транзакция "внесение средств на счет пользователя"
payment - транзакция "списание средств со счета пользователя в счет оплаты"
return  - транзакция "возврат средств пользователю из-за невыполненной услуги"
*/