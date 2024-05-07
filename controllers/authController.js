const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const moment = require("moment");
const Children = require('../models/childrenModel');




exports.signup = catchAsync(async (req, res, next) => {
  let {
    role,
    firstName,
    lastName,
    email,
    dob,
    password,
    scoringLevel,
  } = req.body;
  const files=req.files;
  console.log(files)
  console.log(req.body)

  // const otpCode = Math.floor(1000 + Math.random() * 9000)
  let newUser;

 

  // const newCustomer = await customer(req.body.email);

  const obj = {
    firstName,
    lastName,
    email,
    dob,
    password,
    scoringLevel,
    role,
  };
  console.log("🚀 ~ exports.signup=catchAsync ~ obj:", obj)

  if(files?.photo)obj.photo=files?.photo[0].key;

  newUser = await User.create(obj);


  const url = ` https://four-pillar-8ab34604fe05.herokuapp.com/api/v1/users/verify-me/${newUser?._id}`

  await new Email(newUser, url).sendUserRegisterEmail();

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  console.log("🚀 ~ exports.login=catchAsync ~ email, password:", email, password)

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists 
  let user = await User.findOne({ email })

  if (!user)
    return next(new AppError('No user is specified with this email.', 401));

    

  // 3) If everything ok, send token to client

  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(200).json({
    status: 'success',
    data: { user, token },
  });
});

// Admin login
exports.adminLogin = catchAsync(async (req, res, next) => {
  const { email, password, role } = req.body;

  if (role !== 'admin' || role === undefined)
    return next(new AppError('you are not admin.', 401));

  const isUseralreadyExist = await User.findOne({ email });
  if (!isUseralreadyExist)
    return next(new AppError('No user is specified with this email.', 401));

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email })

  if (user.role === 'user') return next(new AppError('Not a user route.', 401));


  // Remove password from output
  user.password = undefined;

  res.status(200).json({
    status: 'success',
    data: {
      user,
      token,
    },
  });
});

exports.logout = catchAsync(async (req, res) => {
  const { user } = req
 
  const updatedUser = await User.findByIdAndUpdate(user._id, {
    lastLogin: Date.now(),
    isOnline: false
  });

  res.status(200).json({ status: 'success', data: updatedUser });
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  console.log("dsdsd", req.headers.authorization)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id).select('+wallet');

  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  // res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    console.log('req.user.role', req.user.role, { roles });
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  let user = await User.findOne({ email: req.body.email });
  console.log("🚀 ~ exports.forgotPassword=catchAsync ~ user:", user)
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 3) Send it to user's email
  try {
    const code = Math.floor(1000 + Math.random() * 9000);
    const resetCode = 'Your password resetcode is ' + code;

    user = await User.findOneAndUpdate(
      { email: req.body.email },
      { passwordResetCode: code },
      { new: true, runValidators: false }
    );

    await new Email(user, resetCode).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Code sent to email!',
    });
  } catch (err) {
    return next(
      new AppError('There was an error sending the email. Try again later!', err),
      500
    );
  }
});

exports.verifyMe = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  let updatedUser = await User.findByIdAndUpdate(id, { isVerified: true }, { new: true });

  if (!updatedUser) return next(new AppError('Verification Failed'), 400);

  return res.redirect("https://sureshluhano.github.io/email-verify/");

  // res.status(200).json({
  //   status: 'success',
  //   data: updatedUser
  // });
});

exports.me = catchAsync(async (req, res, next) => {

  const { user } = req;
  let foundUser = await User.findById(user?._id)

  res.status(200).json({
    status: 'success',
    data: foundUser
  });
});

exports.myFavourites = catchAsync(async (req, res, next) => {

  const { user } = req;
  const favourites = await Favourite.find({user:user?._id}).populate([{path:"user"},{path:"product"}])

  res.status(200).json({
    status: 'success',
    data: favourites
  });
});

exports.statistics = catchAsync(async (req, res, next) => {

  const [totalUsers, blockedUsers, totalVideos] = await Promise.all([
    User.countDocuments({ isPaymentDone: true, isVerified: true, isActive: true }),
    User.countDocuments({ isPaymentDone: true, isVerified: true, isActive: false }),
    Video.countDocuments(),
    // User.countDocuments(),
  ])

  const tools = await Video.find({ videoType: "tool" }).populate({ path: "comments" }).sort({ "comments.rating": -1 })
  const groundworks = await Video.find({ videoType: "groundwork" }).populate({ path: "comments" }).sort({ "comments.rating": -1 })
  const blooms = await Video.find({ videoType: "bloom" }).populate({ path: "comments" }).sort({ "comments.rating": -1 })
  const lastMonthDate = moment().subtract(1, "month").format();
  const date = new Date(lastMonthDate)

  const resonanceFinderUsers = await User.find({ "resonanceResult.averageScore": { $gt: 0 }, resonanceResultDate: { $gt: date } }).populate({ path: 'avatar' })
  const users = await User.find({ bloom: { $ne: null } })

  const usersBloomPercentageTotal = await users.reduce((accumulator, currentValue) => accumulator + currentValue.bloomPercentage, 0);
  const averageBloomPercentage = (usersBloomPercentageTotal / (users.length * 100)) * 100;
  const totalBloomsCheck = await User.aggregate(
    [
      {
        '$lookup': {
          'from': 'blooms',
          'localField': 'bloom',
          'foreignField': '_id',
          'as': 'bloom'
        }
      }, {
        '$unwind': {
          'path': '$bloom'
        }
      }, {
        '$group': {
          '_id': '$bloom._id',
          '_id': {
            'title': '$bloom.title'
          },
          'count': {
            '$sum': 1
          }
        }
      }, {
        '$project': {
          'title': '$_id.title',
          'count': 1,
          '_id': 0
        }
      }
    ]
  )

  // const mostViewedYeachers=await User.find({role:"teacher"}).sort({viewsCount:-1})

  res.status(200).json({
    status: 'success',
    data: {
      totalUsers: totalUsers || 0,
      blockedUsers: blockedUsers || 0,
      totalVideos: totalVideos || 0,
      tools,
      groundworks,
      blooms,
      averageBloomPercentage,
      totalBloomsCheck,
      resonanceFinderUsers
    }
  });
});

exports.verifyForgotPasswordOtp = catchAsync(async (req, res, next) => {
  const { email, otpCode } = req.body;
  console.log(req.body);
  console.log("🚀 ~ exports.verifyForgotPasswordOtp=catchAsync ~ email, otpCode:", email, otpCode)
  const doc = await User.findOneAndUpdate({ email, passwordResetCode: otpCode }, { passwordResetCode: null },  { new: true });

  if (!doc) return next(new AppError('Invalid Code'), 400);

  res.status(200).json({
    status: 'success',
  });
});

exports.resendOtp = catchAsync(async (req, res, next) => {
  const { user } = req;

  const otpCode = Math.floor(100000 + Math.random() * 900000);

  const payload = {
    msg: `Your Confirmation Code is ${otpCode}`,
  };

  await new Email(user).sendUserRegisterEmail(payload);
  const updatedUser = await User.findByIdAndUpdate(user?._id, { verificationCode: otpCode }, { new: true })

  res.status(200).json({
    status: "success",
    message: 'Otp Successfully Resend',
    data: updatedUser
  });
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { token } = req.query;
  const { token1 } = req.params;

  res.render('password-page', { token });
  // res.render('thankyou', { token });
});

exports.resetPasswordDone = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  // const hashedToken = crypto
  //   .createHash('sha256')
  //   .update(req.params.token)
  //   .digest('hex');

  const user = await User.findOne({
    email: req.body.email,
  });
console.log(req.body, user, 'resetPasswordDone line No.533')
  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Invalid Email', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  // await new Email(user, (resetURL = '')).sendPasswordResetComfirmation();
  // await sendPasswordResetComfirmation(neUser);

  // res.render('thankyou');
  res.send('Password Reset Successfully');

  // createSendToken(user, 200, req, res, 'resetPasswordDone');
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select(
    '+password +isVerified +wallet'
  );

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});


exports.childSignup = catchAsync(async (req, res, next) => {
  let {
    role,
    firstName,
    lastName,
    email,
    dob,
    password,
    scoringLevel,
  } = req.body;
  const files=req.files;
  console.log(files)
  console.log(req.body)

  // const otpCode = Math.floor(1000 + Math.random() * 9000)
  let newUser;

 

  // const newCustomer = await customer(req.body.email);

  const obj = {
    firstName,
    lastName,
    email,
    dob,
    password,
    scoringLevel,
    role,
  };
  console.log("🚀 ~ exports.signup=catchAsync ~ obj:", obj)

  if(files?.photo)obj.photo=files?.photo[0].key;

  newUser = await Children.create(obj);


  const url = ` https://four-pillar-8ab34604fe05.herokuapp.com/api/v1/users/verify-me/${newUser?._id}`

  await new Email(newUser, url).sendUserRegisterEmail();

  createSendToken(newUser, 201, req, res);
});

exports.childLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  console.log("🚀 ~ exports.login=catchAsync ~ email, password:", email, password)

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists 
  let user = await Children.findOne({ email })

  if (!user)
    return next(new AppError('No user is specified with this email.', 401));

    

  // 3) If everything ok, send token to client

  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(200).json({
    status: 'success',
    data: { user, token },
  });
});
