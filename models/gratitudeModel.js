const mongoose = require('mongoose');

const GratitudeSchema = new mongoose.Schema({
    gratitudeInput1,
    gratitudeInput2,
    gratitudeInput3,
},
    { timestamps: true }
);

const WriteGratitude = mongoose.model('WriteGratitude', GratitudeSchema);
module.exports = WriteGratitude;