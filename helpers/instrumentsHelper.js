const db = require('openfsm-database-connection-producer');
const SQL        = require('common-payment-service').SQL;
const MESSAGES   = require('common-payment-service').MESSAGES;
const logger     = require('openfsm-logger-handler');


require('dotenv').config();

exports.getInstuments = async (userId) => {
  const result = await new Promise((resolve, reject) => {
    db.query(SQL.INSTRUMENTS.SQL_GET_INSTRUMENTS, [], (err, result) => {              
      if (err) {
        logger.error(err);
        return reject(err);
      }
      resolve(result); // Предполагается, что поле isConfirmed
    });
  });   
  return  result != undefined ? result?.rows: null
};

exports.getCards = async (userId) => {
  const result = await new Promise((resolve, reject) => {
    db.query(SQL.CARDS.SQL_GET_CARDS, [userId], (err, result) => {              
      if (err) {
        logger.error(err);
        return reject(err);
      }
      resolve(result); // Предполагается, что поле isConfirmed
    });
  });   
  return  result != undefined ? result?.rows: null
};


exports.setDefaultCard = async (userId, cardId) => {
  const result = await new Promise((resolve, reject) => {
    db.query(SQL.INSTRUMENTS.SQL_SET_DEFAULT_CARD, [userId, cardId], (err, result) => {              
      if (err) {
        logger.error(err);
        return reject(err);
      }
      resolve(result); // Предполагается, что поле isConfirmed
    });
  });   
  return  result != undefined ? result?.rows: null
};

exports.deleteCard = async (userId, cardId) => {
  const result = await new Promise((resolve, reject) => {
    db.query(SQL.INSTRUMENTS.SQL_DELETE_CARD, [userId, cardId], (err, result) => {              
      if (err) {
        logger.error(err);
        return reject(err);
      }
      resolve(result); // Предполагается, что поле isConfirmed
    });
  });   
  return  result != undefined ? result?.rows: null
};