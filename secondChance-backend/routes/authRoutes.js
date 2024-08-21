const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xss = require('xss');
const connectToDatabase = require('../models/db');
const router = express.Router();
const dotenv = require('dotenv');
const pino = require('pino');  // Import Pino logger
dotenv.config();
const cleanInput = (input) => xss(input);

const mongoCollectionName = process.env.MONGO_COLLECTION_users;

const { body, validationResult } = require('express-validator');

const logger = pino();  // Create a Pino logger instance

//Create JWT secret
const JWT_SECRET = process.env.JWT_SECRET;


router.post('/register', [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        //Connect to `secondChance` in MongoDB through `connectToDatabase` in `db.js`.
        const db = await connectToDatabase();
        const collection = db.collection(mongoCollectionName);

        const { firstName, lastName, email, password } = req.body;
        const cleanedFirstName = cleanInput(firstName);
        const cleanedLastName = cleanInput(lastName);
        const cleanedEmail = cleanInput(email);

        const existingUserByEmail = await collection.findOne({ "email": cleanedEmail });
        const existingUserByName = await collection.findOne({
            "firstName": cleanedFirstName,
            "lastName": cleanedLastName
        });

        if (existingUserByEmail) {
            return res.status(400).json({error:'User already exists with this email.'});
        }
        if (existingUserByName) {
            return res.status(400).json({error:'User already exists with this name.'});
        }
        const saltRounds = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = {
            firstName: cleanedFirstName,
            lastName: cleanedLastName,
            email: cleanedEmail,
            password: hashedPassword,
            createdAt: new Date(),
            loginAttempts: 0, //Number of failed login attempts
            lockUntil: null
        }

        await collection.insertOne(newUser);

        const payload = {
            user: {
                id: newUser.insertedId,
            },
        };
        const userName = newUser.firstName;
        const userEmail = newUser.email;

        const authtoken = jwt.sign(payload, JWT_SECRET, { expiresIn: '14h' }, (err, token) => {
            if (err) {
                logger.error('Error signing token', err);
                return res.status(500).json({ error: 'Token generation failed' });
            }
            return res.status(200).json({ authtoken: token, user: { userName: userName, userEmail: userEmail } });
        });

        logger.info('User registered successfully');

    } catch (e) {
        logger.error(e);
        return res.status(500).send('Internal server error');
    }
});


router.post('/login', async (req, res) => {
    try {
        //Connect to `secondChance` in MongoDB through `connectToDatabase` in `db.js`.
        const db = await connectToDatabase();
        const collection = db.collection(mongoCollectionName);

        const { email, password } = req.body;

        const existingUser = await collection.findOne({ "email": email });


        // If user does not exist or password is incorrect
        if (!existingUser || !(await bcrypt.compare(password, existingUser.password))) {
            // Check if the account is locked
            if (existingUser && existingUser.lockUntil && existingUser.lockUntil > Date.now()) {
                // Calculate remaining time for unlocking
                const remainingTime = Math.ceil((existingUser.lockUntil - Date.now()) / 60000); // in minutes
                return res.status(403).json({ error: `Account locked. Please try again after ${remainingTime} minites.` });
            }

            // Increment login attempts
            const updateFields = { $inc: { loginAttempts: 1 } };

            // Lock the account if login attempts exceed the limit
            if (existingUser && existingUser.loginAttempts > 4) {
                updateFields.$set = { lockUntil: Date.now() + 5 * 60 * 1000 }; // Lock for 5 minutes
            }

            // Update the user's login attempts and lock status
            await collection.updateOne({ email }, updateFields);

            logger.error('Invalid email or password.');
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Reset login attempts and lock status on successful login
        await collection.updateOne({ email }, { $set: { loginAttempts: 3, lockUntil: null } });

        // Create JWT payload
        let payload = {
            user: {
                id: existingUser._id.toString(),
            },
        };

        const userName = existingUser.firstName;
        const userEmail = existingUser.email;

        //Create JWT authentication if passwords match

        const authtoken = jwt.sign(payload, JWT_SECRET, { expiresIn: '14h' }, (err, token) => {
            if (err) {
                logger.error('Error signing token', err);
                return res.status(500).json({ error: 'Token generation failed' });
            }
            return res.status(200).json({ authtoken: token, user: { userName: userName, userEmail: userEmail } });
        });

        logger.info('User login successfully');
        //Send appropriate message if user not found


    } catch (e) {
        logger.error(e);
        return res.status(500).json({ error: 'Internal server error', details: e.message });
    }
});



router.put('/update', async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.error('Validation errors in update request', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const firstName = req.body.name;
        const lastName = req.body.lastName;
        const email = req.headers.email;
        const emailBody = req.body.email;
        const password = req.body.password;
        if (!email) {
            logger.error('Email not found in the request headers');
            return res.status(400).json({ error: "Email not found in the request headers" });
        }

        const db = await connectToDatabase();
        const collection = db.collection(mongoCollectionName);

        const existingUser = await collection.findOne({ "email": email });

        if (!existingUser) {
            logger.error('User not found');
            return res.status(404).json({ error: "User not found" });
        }

        let updatedFields = {};
        if (firstName) { updatedFields.firstName = firstName };
        if (lastName) { updatedFields.lastName = lastName };
        if (emailBody) { updatedFields.email = emailBody };

        if (password) {
            const saltRounds = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            updatedFields.password = hashedPassword;
        }
        updatedFields.updatedAt = new Date();

        const updatedUser = await collection.findOneAndUpdate(
            { email },
            { $set: updatedFields },
            { returnDocument: 'after' }
        );


        if (!updatedUser) {
            logger.error('Error updating user');
            return res.status(500).json({ error: "Failed to update user" });
        };

        const payload = {
            user: {
                id: updatedUser._id.toString(),
            },
        };
        const authtoken = jwt.sign(payload, JWT_SECRET, { expiresIn: '14h' });

        logger.info('User updated successfully');

        res.json({
            authtoken: authtoken,
            message: 'User updated successfully',
            updatedAt: updatedFields.updatedAt
        });


    } catch (e) {
        logger.error('Error processing request', { error: e.message, stack: e.stack, requestBody: req.body });
        console.error('Error processing request:', e);
        return res.status(500).send('Internal server error');
    }
});

module.exports = router;