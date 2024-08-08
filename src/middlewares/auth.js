const jwt = require('jsonwebtoken');
const User=require("../models/userModel")

const auth = async(req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({
            code: 401,
            message: 'No token provided',
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch user from the database
        const user = await User.findById(decoded._id);

        if (!user) {
            return res.status(401).json({
                code: 401,
                message: 'User not found',
            });
        }

        // Convert iat to IST format
        const iatDate = new Date(decoded.iat * 1000);
        const options = {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        };
        const iatIST = iatDate.toLocaleString('en-IN', options);

        decoded.iat = iatIST; // Update iat to formatted IST date
        req.user = user; // Attach the user to req.user
        req.tokenData = decoded; // Attach the decoded token data to req.tokenData

        next();
    } catch (err) {
        res.status(401).json({
            code: 401,
            message: 'Invalid token',
        });
    }
};

module.exports = auth;
