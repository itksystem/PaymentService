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
  if (!userId) return Promise.resolve(null);

  console.log(`accountHelper.create ${userId}`);

  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO pa_payment_service.accounts (user_id, balance, created_at, updated_at)
       VALUES ($1, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [userId],
      (err, insertResult) => {
        if (err) return reject(err);

        db.query(
          'SELECT * FROM pa_payment_service.accounts WHERE user_id = $1',
          [userId],
          (err, selectResult) => {
            if (err) return reject(err);
            resolve(selectResult.rows.length > 0 ? selectResult.rows[0] : null);
          }
        );
      }
    );
  });
};


 /* найти счет */
 exports.findByAccountId = (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM pa_payment_service.accounts WHERE account_id = $1';
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
      const sql = 'SELECT * FROM pa_payment_service.accounts WHERE user_id = $1';
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
      const sql = `UPDATE pa_payment_service.accounts SET  balance = balance - $1,  updated_at = CURRENT_TIMESTAMP  WHERE account_id = $2`;
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
      const sql = `UPDATE pa_payment_service.accounts SET  balance = balance + $1,  updated_at = CURRENT_TIMESTAMP  WHERE account_id = $2`;
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
          const sql = `UPDATE pa_payment_service.accounts SET  balance = balance + $1,  updated_at = CURRENT_TIMESTAMP  WHERE account_id = $2`;
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