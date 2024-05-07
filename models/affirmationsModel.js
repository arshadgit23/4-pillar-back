const mongoose = require('mongoose');

const affirmationsSchema = new mongoose.Schema({
    affirmationText: {
        type: String,
        require: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    }
}
);

const Affirmations = mongoose.model('Affirmations', affirmationsSchema);
module.exports = Affirmations;