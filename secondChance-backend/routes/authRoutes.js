const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const logger = require('../logger');
const connectToDatabase = require('../models/db');
require('dotenv').config();
const mongoCollectionName = process.env.MONGO_COLLECTION_users;
const JWT_SECRET = process.env.JWT_SECRET;
const saltRounds = 10;

router.post('/register', async (req, res) => {
    try {
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

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = {
            firstName: firstName,
            lastName:lastName,
            email: email,
            password: hashedPassword
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
        return res.status(500).send('Internal server error');
    }
});


module.exports = router;