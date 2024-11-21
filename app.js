const express = require('express');
const bodyParser = require('body-parser');
const paymentRoutes = require('./routes/payment');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

app.use(function(request, response, next){
  console.log(request);  
  next();
});


app.use('/api/payment', paymentRoutes);


app.listen(process.env.PORT, () => {
  console.log(`
    ******************************************
    * ${process.env.SERVICE_NAME} running on port ${process.env.PORT} *
    ******************************************`);
});

