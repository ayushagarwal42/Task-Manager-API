const express = require('express');
const router = express.Router();

//model
const User = require('../models/userModel');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

//middleware
const auth = require('../middlewares/auth');

// Sign Up Route
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ code: 400, message: 'Please provide all required fields: name, email, password' });
        }
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ code: 400, message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 8);

        // Create user
        const user = await User.create({ name, email, password: hashedPassword });
        if (user) {
            return res.status(201).json({ code: 201, message: 'user created successfully', user: user })
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

//login route
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                code: 400,
                message: 'Please provide email and password',
            });
        }
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                code: 400,
                message: 'Invalid email or password',
            });
        }
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                code: 400,
                message: 'Invalid email or password',
            });
        }

        // Generate auth token
        const token = jwt.sign({ _id: user._id.toString(), email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // user.tokens = user.tokens.concat({ token });
        // await user.save();  // Ensure user tokens are saved

        // Send response
        res.status(200).json({ code: 200, message: 'Login successful', data: { user, token } });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

//update details route
router.patch("/updateDetails", auth, async (req, res) => {
    const email = req.query.email;
    const { name, password } = req.body;
    if (!email) {
        return res.status(400).json({
            code: 400,
            message: "Email not provided in the query",
        });
    }
    try {
        //find user on the basis of email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                code: 404,
                message: "user not found for this email"
            });
        }
        //update fields if they are provided in the request body
        if (name) {
            user.name = name;
        }
        if (password) {
            user.password = await bcrypt.hash(password, 8);
        }
        const result = await User.updateOne({ email }, { $set: { name: name, password: password } });
        console.log(result)

        if (result.matchedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: "User not found for this email",
            });
        }

        res.status(200).json({
            code: 200,
            message: "User updated successfully",
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
})

//delete user route
router.delete("/delete", auth, async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            code: 400,
            message: "Email not provided in the body",
        });
    }
    try {
        const user = await User.findOneAndDelete({ email });
        if (!user) {
            return res.status(400).json({
                code: 400,
                message: "user not found for this email"
            })
        }
        res.status(200).json({
            code: 200,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message
        });
    }
})
// Route to delete multiple users
router.delete("/deleteselectedusers", async (req, res) => {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({
            code: 400,
            message: "Please provide an array of emails to delete",
        });
    }

    try {
        // Delete users with the provided emails
        const result = await User.deleteMany({ email: { $in: emails } });

        // Check if any users were deleted
        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: "No users found with the provided emails",
            });
        }

        res.status(200).json({
            code: 200,
            message: `${result.deletedCount} user(s) deleted successfully`,
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});

// Route to delete all users
router.delete("/deleteallusers", async (req, res) => {
    try {
        const result = await User.deleteMany({});

        // Check if any users were deleted
        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: "No users found to delete",
            });
        }

        res.status(200).json({
            code: 200,
            message: `${result.deletedCount} user(s) deleted successfully`,
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});

// Route to initiate password reset (send reset token to email)
router.post('/resetPassword/initiate', async (req, res) => {

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({
            code: 400,
            message: 'Please provide an email address',
        });
    }
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                code: 404,
                message: 'User not found',
            });
        }

        // Clear previous OTP if exists
        await User.updateOne(
            { email },
            {
                $unset: {
                    otp: "",
                    expiryAtLocal: ""
                }
            }
        );

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 8);

        const otpGeneratedAt = Date.now();
        const otpExpiry = otpGeneratedAt + 10 * 60 * 1000;; // 10 min expiry in milliseconds
        const expiryAtLocal = new Date(otpExpiry).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        // Store OTP and expiry time
        await User.updateOne(
            { email },
            {
                $set: {
                    otp: otpHash,
                    expiryAtLocal: expiryAtLocal,
                }
            }
        );
        // Read the HTML email template from a file
        const htmlTemplate = fs.readFileSync(path.join(__dirname, '../emailTemplate.html'), 'utf-8');

        // Replace placeholders in the HTML template with actual values
        const customizedHtml = htmlTemplate.replace('{{otp}}', otp);
        // Create the HTML email template
        // const htmlTemplate = `
        //     <h1>Password Reset Request</h1>
        //     <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        //     <p>Your OTP for password reset is <strong>${otp}</strong>.</p>
        //     <p>Please use this OTP to reset your password within one hour of receiving it.</p>
        //     <p>If you did not request this, please ignore this email.</p>
        // `;

        // Send otp via email
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset OTP',
            // text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
            //     `Your OTP for password reset is ${otp}.\n\n` +
            //     `Please use this OTP to reset your password within one hour of receiving it.\n` +
            //     `If you did not request this, please ignore this email.\n`,
            // html: htmlTemplate, // Use the HTML template here,
            html: customizedHtml
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({
            code: 200,
            message: `otp sent to your email: ${user.email}`,
            expiryAtLocal: expiryAtLocal,
        });

    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
})

// Route to complete password reset (using OTP)
router.post('/resetPassword/complete', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({
            code: 400,
            message: 'Please provide email, OTP, and new password',
        });
    }

    try {
        // Find user with valid OTP
        const user = await User.findOne({
            email,
            otp: { $exists: true },
            expiryAtLocal: { $exists: true }, // Check if expiryAtLocal exists
        });

        if (!user) {
            return res.status(400).json({
                code: 400,
                message: 'Invalid or expired OTP',
            });
        }

        // Verify OTP
        const isOtpValid = await bcrypt.compare(otp, user.otp);
        if (!isOtpValid) {
            return res.status(400).json({
                code: 400,
                message: 'Invalid OTP',
            });
        }

        // Update the password
        const hashedPassword = await bcrypt.hash(newPassword, 8);
        await User.updateOne(
            { email },
            {
                $set: {
                    password: hashedPassword,
                    // otp: null,  // Clear the OTP
                    // otpExpiry: null,  // Clear the expiry
                },
                $unset: {
                    otp: "",  // Remove the OTP field
                    expiryAtLocal: ""  // Remove the OTP expiry field
                }
            }
        );

        res.status(200).json({
            code: 200,
            message: 'Password reset successfully',
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});

// Route to get all users
router.get('/allusers', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query; // Default to page 1, 10 users per page
        // Ensure page and limit are greater than 0
        if (page <= 0 || limit <= 0) {
            return res.status(400).json({
                code: 400,
                message: 'Page and limit must be greater than 0'
            });
        }
        const totalUsers = await User.countDocuments({});
        const totalPages = Math.ceil(totalUsers / limit);

        // Check if the requested page exceeds the total number of pages
        if (Number(page) > totalPages) {
            return res.status(400).json({
                code: 400,
                message: 'Page exceeds total number of pages',
                data: [],
                currentPageUsersCount: 0,
                totalUsers,
                currentPage: Number(page),
                totalPages
            });
        }

        const users = await User.find({}, { _id: 0, password: 0, __v: 0 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const currentPageUsersCount = users.length;

        res.status(200).json({
            code: 200,
            message: 'Users retrieved successfully',
            data: users,
            currentPageUsersCount,
            totalUsers,
            currentPage: Number(page),
            totalPages,
            
            
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            code: 500,
            message: error.message
        });
    }
});






module.exports = router;