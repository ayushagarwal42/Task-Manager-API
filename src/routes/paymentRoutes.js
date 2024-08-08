require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const router = express.Router();

// Create an instance of Razorpay
const razorpay = new Razorpay({
  key_id: process.env.YOUR_RAZORPAY_KEY_ID,
  key_secret: process.env.YOUR_RAZORPAY_KEY_SECRET
});

// Endpoint to create an order
router.post('/create-order', async (req, res) => {
  try {
    const options = {
      amount: 200, // amount in the smallest currency unit
      currency: 'INR',
      receipt: 'receipt#1'
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
