const express = require('express');
const router = express.Router();
const connectToDatabase = require('../models/db');
require('dotenv').config();
const mongoCollectionName = process.env.MONGO_COLLECTION;

// Search for secondChanceItems
router.get('/', async (req, res, next) => {
    try {
        // Connect to MongoDB using connectToDatabase and store the connection in `db`
        const db = await connectToDatabase();
        const collection = db.collection(mongoCollectionName);

        // Initialize the query object
        let query = {};

        // Add the name filter to the query if the name parameter is not empty
        if (req.query.name && req.query.name.trim() !== '') {
            query.name = { $regex: new RegExp(req.query.name, 'i') }; // Using regex for partial match, case-insensitive
        }

        // Add other filters to the query
        if (req.query.category && req.query.category.trim() !== '') {
            query.category = req.query.category;
        }
        if (req.query.condition && req.query.condition.trim() !== '') {
            query.condition = req.query.condition;
        }
        if (req.query.age_years && req.query.age_years.trim() !== '') {
            const ageYears = parseInt(req.query.age_years);
            if (!isNaN(ageYears)) {
                query.age_years = { $lte: ageYears };
            }
        }

        // Fetch filtered secondChanceItems using the find(query) method
        const items = await collection.find(query).toArray();

        // Send the results as JSON
        res.status(200).json(items.length ? items : { message: "No secondChanceItems found matching the criteria" });
    } catch (e) {
        console.error('Error fetching secondChanceItems:', e);
        next(e);
    }
});

module.exports = router;