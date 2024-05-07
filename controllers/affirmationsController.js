const Affirmations = require('../models/affirmationsModel');
const AppError = require('../utils/appError');

// create affirmations controller
exports.addAffilations = async(req, res, next) => {
    try {
     const {affirmationText} = req.body;
    

     const affirmation = new Affirmations({affirmationText});
     await affirmation.save();
     
    } catch (error) {
     console.error(error);
     return res.status(500).json({ message: 'Server error' });
    }
};
