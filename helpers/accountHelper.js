const amqp = require('amqplib');
const db = require('openfsm-database-connection-producer');
const TransactionModel = require('../helpers/transactionHelper');
const ClientProducerAMQP = require('openfsm-client-producer-amqp'); 
if (!ClientProducerAMQP) {
  throw new Error('ClientProducerAMQP is not defined');
}
require('dotenv').config({ path: '.env-payment-service' });

const { RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_PAYMENT_ACCOUNT_CREATE_QUEUE} = process.env;
const login = RABBITMQ_USER || 'guest';
const pwd = RABBITMQ_PASSWORD || 'guest';
const PAYMENT_ACCOUNT_CREATE = RABBITMQ_PAYMENT_ACCOUNT_CREATE_QUEUE || 'PAYMENT_ACCOUNT_CREATE';
const host = RABBITMQ_HOST || 'rabbitmq-service';
const port = RABBITMQ_PORT || '5672';


 /* создать счет  */
 exports.create = (userId) => {
  if(!userId) return null;
  console.log(`accountHelper.create ${userId}`)
  return new Promise((resolve, reject) => {    
    db.query(`INSERT IGNORE INTO accounts (user_id, balance, created_at, updated_at) VALUES( ?, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [userId], (err, result) => {
      (err)
      ? reject(err)
      :  db.query('SELECT * FROM accounts WHERE user_id = ?', [userId], (err, result) => {
          (err)
           ? reject(err)
           : resolve((result[0] != undefined ? result[0]: null));
         });     
      });
  });
};

 /* найти счет */
 exports.findByAccountId = (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM accounts WHERE account_id = ?';
      db.query(sql, [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result[0] != undefined ? result[0]: null));
      });
    });
  };

   /* найти счет */
 exports.findByUserId = (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM accounts WHERE user_id = ?';
      db.query(sql, [id], (err, result) => {
        (err)
        ? reject(err)
        : resolve((result[0] != undefined ? result[0]: null));
      });
    });
  };

  /* списать сумму со счета */
  exports.withdraw = (amount, account_id ) => {
    return new Promise((resolve, reject) => {      
      const sql = `UPDATE accounts SET  balance = balance - ?,  updated_at = CURRENT_TIMESTAMP  WHERE account_id = ?`;
      db.query(sql, [amount, account_id], (err, result) => {
        (err)
        ? reject(err)
        : resolve(result.affectedRows > 0 ? true : false); 
      });
    });
  };


   /* подкрепление счета суммы транзакии */
   exports.deposit = (amount, account_id ) => {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE accounts SET  balance = balance + ?,  updated_at = CURRENT_TIMESTAMP  WHERE account_id = ?`;
      db.query(sql, [amount, account_id], (err, result) => {
        (err)
        ? reject(err)
        : resolve(result.affectedRows > 0 ? true : false); 
      });
    });
  };
  
     /* подкрепление счета суммы транзакии */
     exports.return = (referenceId) => {
        return new Promise(async (resolve, reject) => {
          const _transaction =  await TransactionModel.findByReferenceId(referenceId);  // создали транзакцию  return     
          const sql = `UPDATE accounts SET  balance = balance + ?,  updated_at = CURRENT_TIMESTAMP  WHERE account_id = ?`;
          db.query(sql, [_transaction.amount, _transaction.account_id], (err, result) => {
            (err)
            ? reject(err)
            : resolve(result.affectedRows > 0 ? true : false); 
          });
        });
      };
      
  
      // Подключение к RabbitMQ и прослушивание очереди
async function startConsumer(queue) {
  try {        
      const connection = await amqp.connect(`amqp://${login}:${pwd}@${host}:${port}`);
      const channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });
      console.log(`Ожидание сообщений в очереди ${queue}...`);

      channel.consume(queue, async (msg) => {
          if (msg !== null) {
              let message = msg.content.toString();
              const messageContent = JSON.parse(message);
              const {userId} = messageContent;     
              await  exports.create(userId);
              channel.ack(msg); // Подтверждение обработки сообщения
          }
      });
  } catch (error) {
      console.error(`Ошибка подключения к RabbitMQ: ${error}`);
  }
}

startConsumer(PAYMENT_ACCOUNT_CREATE);