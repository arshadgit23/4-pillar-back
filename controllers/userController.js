const multer = require('multer');
const moment = require('moment');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
// const { getUploadingSignedURL } = require('../utils/s3');
const { v4: uuidv4 } = require('uuid');



exports.getAllUsersForAdmin = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 400;
  const skip = (page - 1) * limit;

  const { search, status, role} = req.query;

  let query = {...(role=="allUsers"?{role:{$in:['parent','child','trader']}}:{role})}

  if (search && search != '')
    query = {
      ...query,
      $or: [
        { email: { $regex: search, $options: 'i' } },
      ],
    };

  if (status == "all") {
    query = {
      ...query,
      isActive: { $in: [true, false] }
    }
  }
  else if (status == "active") {
    query = {
      ...query,
      isActive: true,
      isBlockedByAdmin:false
    }
  }
  else if (status == "blocked") {
    query = {
      ...query,
      isActive: true,
      isBlockedByAdmin:true
    }
  }
  else {
    query = {
      ...query,
      isActive: false
    }
  }

  console.log("🚀 ~ file: userController.js:135 ~ exports.getAllUsersForAdmin=catchAsync ~ query:", query)
  const users = await User.find(query).skip(skip).limit(limit);

  const [allUsers,allBuyers,allVendors,allTraders]=await Promise.all([
    User.countDocuments({role:{$in:['parent','child','trader']}}),
    User.countDocuments({role:'parent'}),
    User.countDocuments({role:'child'}),
    User.countDocuments({role:'trader'})
  ])

  res.status(200).json({
    status: 'success',
    results: users?.length || 0,
    allUsers,
    allBuyers,
    allVendors,
    allTraders,
    data: users,
  });
});
