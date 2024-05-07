const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');

// write gratitude post route
router.post('/write-journal', journalController.writeJournal);
router.get('/get-journal', journalController.getJournal);


module.exports = router;
