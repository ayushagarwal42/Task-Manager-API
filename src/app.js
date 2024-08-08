const express=require("express");
require("./db/mongoose");
require('dotenv').config();
// require("./cron")
const cors = require('cors');

const app=express();
app.use(express.json());//middleware to parse json

app.use(cors());
// enable CORS only for your frontend domain
app.use(cors({
  origin: 'http://localhost:5173' // Adjust if your frontend is hosted elsewhere
}));

//import routes
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/payment', paymentRoutes);

const port=process.env.PORT || 3000;

app.listen(port,()=>{
    console.log(`Server Is Running On Port http://localhost:${port}/`)
})