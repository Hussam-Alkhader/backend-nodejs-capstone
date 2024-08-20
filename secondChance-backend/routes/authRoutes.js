const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connectToDatabase = require('../models/db');
const router = express.Router();
const dotenv = require('dotenv');
const pino = require('pino');  // Import Pino logger
dotenv.config();

const mongoCollectionName = process.env.MONGO_COLLECTION_users;

const logger = pino();  // Create a Pino logger instance

//Create JWT secret
const JWT_SECRET = process.env.JWT_SECRET;


router.post('/register', async (req, res) => {
    try {
        //Connect to `secondChance` in MongoDB through `connectToDatabase` in `db.js`.
        const db = await connectToDatabase();
        const collection = db.collection(mongoCollectionName);

        const { firstName, lastName, email, password } = req.body;

        const existingUserByEmail = await collection.findOne({ "email": email });
        const existingUserByName = await collection.findOne({
            "firstName": firstName,
            "lastName": lastName
        });

        if (existingUserByEmail) {
            return res.status(400).send("User already exists with this email.");
        }
        if (existingUserByName) {
            return res.status(400).send("User already exists with this name.");
        }
        const saltRounds = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = {
            firstName: firstName,
            lastName:lastName,
            email: email,
            password: hashedPassword,
            createdAt: new Date(),
        }

        await collection.insertOne(newUser);

        const payload = {
            user: {
                id: newUser.insertedId,
            },
        };
        const authtoken = jwt.sign(payload, JWT_SECRET);

        logger.info('User registered successfully');

        res.status(201).json({ authtoken, email });
    } catch (e) {
        logger.error(e);
        return res.status(500).send('Internal server error');
    }
});


module.exports = router;