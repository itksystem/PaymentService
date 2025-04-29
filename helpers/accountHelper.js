const amqp = require('amqplib');
const db = require('openfsm-database-connection-producer');
const TransactionModel = require('../helpers/transactionHelper');
const ClientProducerAMQP = require('openfsm-client-producer-amqp'); 
if (!ClientProducerAMQP) {
  throw new Error('ClientProducerAMQP is not defined');
}
require('dotenv').config({ path: '.env-payment-service' });

const { 
  RABBITMQ_HOST, 
  RABBITMQ_PORT, 
  RABBITMQ_USER, 
  RABBITMQ_PASSWORD, 
  RABBITMQ_PAYMENT_ACCOUNT_CREATE_QUEUE, 
} = process.env;

  const PAYMENT_ACCOUNT_CREATE = RABBITMQ_PAYMENT_ACCOUNT_CREATE_QUEUE || 'PAYMENT_ACCOUNT_CREATE';
  
  const login = RABBITMQ_USER || 'guest';
  const pwd =   RABBITMQ_PASSWORD || 'guest';
  const host =  RABBITMQ_HOST || 'rabbitmq-service';
  const port =  RABBITMQ_PORT || '5672';


 /* создать счет  */
 exports.create = (userId) => {
  if (!userId) return Promise.resolve(null);
  console.log(`Создание счета accountHelper.create ${userId}`);
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
        : resolve(result.rows[0]);
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
        : resolve(result.rows[0]);
      });
    });
  };

  
  exports.updateBalance = (account_id ) => { // посчитать сумму
    return new Promise((resolve, reject) => {
      const sql = `
    UPDATE pa_payment_service.accounts
    SET 
    balance = COALESCE((
        SELECT SUM(
            CASE 
                WHEN transaction_type = '${TransactionModel.TRANSACTION_TYPE.DEPOSIT}' THEN amount
                WHEN transaction_type = '${TransactionModel.TRANSACTION_TYPE.WITHDRAWAL}' THEN -amount
                ELSE 0
            END
        )
        FROM pa_payment_service.transactions
        WHERE account_id = $1
        AND status = '${TransactionModel.TRANSACTION_STATUS.COMPLETED}'
      ), 0),
      updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $1 RETURNING * 
`;
      db.query(sql, [account_id], (err, result) => {
        (err)
        ? reject(err)
        : resolve(result.rows[0]);
      });
    });
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
                    }
                }
            });
        } catch (error) {
            console.error(`Error connecting to RabbitMQ: ${error}`);
     }
  }

      
/*
Модель для создания счета пользователя
{  "userId" : 14  }
*/

startConsumer(PAYMENT_ACCOUNT_CREATE,
  (msg) => {
    if (msg?.userId) {
        try {
          exports.create(msg?.userId);
          channel.ack(msg); // Подтверждение обработки сообщения          
        } catch (error) {
          console.log(`startConsumer[PAYMENT_ACCOUNT_CREATE] =>`,error,msg);
        }      
    }
  }
);
  
