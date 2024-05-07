
const mongoose = require('mongoose');

const JournalSchema = new mongoose.Schema({
    freeFlow: {
        type: String,
    },
    reFrame: {
        input1: String,
        input2: String,
        input3: String,
        input4: String,
        input5: String
    },
    devotional: {
        type: String,
    }
}, {timestamps: true});

const WriteJournal = mongoose.model('WriteJournal', JournalSchema);
module.exports = WriteJournal;
