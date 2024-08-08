// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const User = require('./models/userModel'); // Adjust the path as needed

// // Connect to your MongoDB database
// mongoose.connect(process.env.MONGODB_URL);

// // Define the cron job
// cron.schedule('*/10 * * * *', async () => {
//   try {
//     const currentDateTime = new Date();
    
//     // Find users with expired OTPs
//     const expiredUsers = await User.find({
//       expiryAtLocal: { $lt: currentDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
//     });

//     // Remove OTP and expiryAtLocal from expired users
//     for (const user of expiredUsers) {
//       await User.updateOne(
//         { _id: user._id },
//         {
//           $unset: {
//             otp: "",
//             expiryAtLocal: ""
//           }
//         }
//       );
//     }

//     console.log(`Expired OTPs removed at ${currentDateTime}`);
//   } catch (error) {
//     console.error('Error while removing expired OTPs:', error);
//   }
// });

// console.log('Cron job started');
