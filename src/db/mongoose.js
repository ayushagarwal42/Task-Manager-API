const mongoose = require("mongoose");
require('dotenv').config();

console.log('MONGODB_URL1:', process.env.MONGODB_URL);

const main = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log(`Connected to database`);
    } catch (err) {
        console.error(err);
    }
};

main();