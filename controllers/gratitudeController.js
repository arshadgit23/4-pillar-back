const Gratitude = require('../models/gratitudeModel');

exports.writeGratitude = async (req, res, next) => {
    // write gratitude
    try {
       const {gratitudeInput1, gratitudeInput2, gratitudeInput3 } = req.body;
    
       const gratitude = new Gratitude({gratitudeInput1, gratitudeInput2, gratitudeInput3 });
       await gratitude.save();
       res.status(201);
    } catch (error) {
       res.status(500).send(error);
    }
};

exports.getGratitude = async(req, res, next) => {
   try {
       const {userId} = req.body;
       const gratitudeData = await Gratitude.find({userId: userId});
       res.status(200).json({
           status: 'success',
           results: gratitudeData.length,
           data: {
               gratitudeData
           }
       });
   } catch (error) {
       res.status(500).json({
           status: 'error',
           message: 'Something went wrong!'
       });
   };
};
