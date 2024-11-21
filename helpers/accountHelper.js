const db = require('openfsm-database-connection-producer');
const TransactionModel = require('../helpers/transactionHelper');

 /* создать счет  */
 exports.create = (userId) => {
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
      
  
      