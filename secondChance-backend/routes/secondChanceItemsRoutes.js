const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const connectToDatabase = require('../models/db');
const logger = require('../logger');

// Define the upload directory path
const directoryPath = 'public/images';

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, directoryPath); // Specify the upload directory
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use the original file name
    },
});

const upload = multer({ storage: storage });


// Get all secondChanceItems
router.get('/', async (req, res, next) => {
    logger.info('/ called');
    try {
        //Step 2: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 2: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 2: task 3 - insert code here
        const secondChanceItems = await collection.find({}).toArray();
        //Step 2: task 4 - insert code here
        res.json(secondChanceItems);


    } catch (e) {
        logger.console.error('oops something went wrong', e)
        next(e);
    }
});

// Add a new item
router.post('/', upload.single('file'), async (req, res, next) => {
    try {        //Step 3: Task 7 insert code here

        //Step 3: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 3: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 3: task 3 - insert code here
        let secondChanceItem = req.body;
        //Step 3: task 4 - insert code here
        const lastItem = await collection.findOne({}, { sort: { id: -1 } });
        if (lastItem && lastItem.id) {
            secondChanceItem.id = (parseInt(lastItem.id) + 1).toString();
        } else {
            secondChanceItem.id = "1";
        }
        //Step 3: task 5 - insert code here
        const date_added = Math.floor(new Date().getTime() / 1000);
        secondChanceItem.date_added = date_added;
        //Step 3: task 6 - insert code here
        result = await collection.insertOne(secondChanceItem);
        const insertedItem = await collection.findOne({ _id: result.insertedId });

        res.status(201).json(insertedItem);
    } catch (e) {
        console.error('Error occurred:', e); // تسجيل تفاصيل الخطأ
        res.status(500).json({ message: 'Internal Server Error', error: e.message }); // إرسال استجابة واضحة
    }
});

// Get a single secondChanceItem by ID
router.get('/:id', async (req, res, next) => {
    try {
        //Step 4: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 4: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 4: task 3 - insert code here
        const idProvided = req.params.id;
        const secondChanceItem = await collection.findOne({ "id": idProvided });
        //Step 4: task 4 - insert code here
        if (!secondChanceItem) {
            return res.status(404).send("secondChanceItem not found");
        }
        res.json(secondChanceItem);

    } catch (e) {
        next(e);
    }
});

// Update and existing item
router.put('/:id', async (req, res, next) => {
    try {
        //Step 5: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 5: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 5: task 3 - insert code here
        const idProvided = req.params.id;
        const { category, condition, age_days, description } = req.body;
        const secondChanceItem = await collection.findOne({ "id": idProvided });
        if (!secondChanceItem) {
            return res.status(404).send("secondChanceItem not found");
        }
        //Step 5: task 4 - insert code here
        secondChanceItem.category = category;
        secondChanceItem.condition = condition;
        secondChanceItem.age_days = age_days;
        secondChanceItem.description = description;
        secondChanceItem.age_years = Number((age_days / 365).toFixed(1));
        secondChanceItem.updatedAt = new Date();

        const updatepreloveItem = await collection.findOneAndUpdate(
            { "id": idProvided },
            { $set: secondChanceItem },
            { returnDocument: 'after' }
        );
        //Step 5: task 5 - insert code here
        if (updatepreloveItem) {
            res.json({ "updated": "success" });
        } else {
            res.status(404).json({ "updated": "failed", "message": "Item not found or no update was made" });
        }
    } catch (e) {
        next(e);
    }
});

// Delete an existing item
router.delete('/:id', async (req, res, next) => {
    try {
        //Step 6: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 6: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 6: task 3 - insert code here
        const idProvided = req.params.id;
        const secondChanceItem = await collection.findOne({ "id": idProvided });
        if (!secondChanceItem) {
            return res.status(404).send("secondChanceItem not found");
        }
        //Step 6: task 4 - insert code here
        const deleteResult = await collection.deleteOne({ "id": idProvided });

        // Check if the deletion was successful
        if (deleteResult.deletedCount === 1) {
            res.json({ "deleted": "success" });
        } else {
            res.status(500).json({ "deleted": "failed", "message": "Error deleting item" });
        }
        
    } catch (e) {
        next(e);
    }
});

module.exports = router;
