const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');

const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/sendEmail');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ), // ms
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // res.cookie('jwt', token);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // 1) Create new user w/ hash pw
  const { name, email, password, passwordConfirm } = req.body;
  const newUser = await User.create({
    name,
    email,
    password,
    passwordConfirm,
  });

  // 2) signToken -> res: newUser + token
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  // 1) user pw exists ?
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Please provide both email and password.', 400));
  }

  // 2) user pw validate ?
  const currentUser = await User.findOne({ email }).select('+password');
  if (
    !currentUser ||
    !(await currentUser.correctPassword(password, currentUser.password))
  ) {
    return next(new AppError('Either email or password is incorrect.', 401));
  }

  createSendToken(currentUser, 200, res);
});

exports.logout = (req, res, next) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    status: 'success',
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) token exist (headers) ?
  let token;
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
  // 2) token validate ?
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) user exist ?
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('No certain user belong with this token!', 401));
  }

  // 4) check if user changed pw after this token created
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    // seccond
    return next(
      new AppError('Password has changed after this token created!', 401)
    );
  }
  // 5) grant access to protected routes.
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.isLogIn = async (req, res, next) => {
  // 1) token exist (headers) ?
  if (req.cookies.jwt) {
    try {
      // 2) token validate ?
      // success : decode la resolved value
      // error: JWT error | JWT expired
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 3) user exist ?
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 4) check if user changed pw after this token created
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        // seccond
        return next();
      }
      // 5) grant access user data to view(s).
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restricTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(
      new AppError('You do not have permission to perform this action', 403)
    );
  }

  next();
};

exports.forgetPassword = catchAsync(async (req, res, next) => {
  // 1) get user from POSTED Email
  const { email } = req.body;
  const currentUser = await User.findOne({ email });
  if (!currentUser) {
    return next(new AppError('Email no exsit', 400));
  }

  // 2) create random reset token and save it into database
  const resetToken = currentUser.createPasswordResetToken();
  await currentUser.save({ validateBeforeSave: false });

  // 3) send email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your Password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}. \nIf you didn't forget password, please this email.`;

  try {
    await sendEmail({
      email,
      subject: 'Your password reset token (valid for 10 mins)',
      message,
    });
    res.status(200).json({
      status: 'success',
      message: 'Reset token send to email successfully',
    });
  } catch (err) {
    currentUser.passwordResetToken = undefined;
    currentUser.passwordResetExpired = undefined;
    await currentUser.save({ validateBeforeSave: false });
    return next(new AppError('There was an error sending the email', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user base on token and date now
  const hashToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const currentUser = await User.findOne({
    passwordResetToken: hashToken,
    passwordResetExpired: { $gt: Date.now() },
  });

  if (!currentUser) {
    return next(new AppError('Reset token invalid or expired!', 401));
  }

  // 2) set new password + update changedPasswordAt
  currentUser.password = req.body.password;
  currentUser.passwordConfirm = req.body.passwordConfirm;
  currentUser.passwordResetToken = undefined;
  currentUser.passwordResetExpired = undefined;

  await currentUser.save();

  // 3) create token + send toeken
  createSendToken(currentUser, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { passwordCurrent, password, passwordConfirm } = req.body;

  // 1) get user
  const currentUser = await User.findById(req.user._id).select('+password');

  // 2) current password invalid ?
  if (
    !(await currentUser.correctPassword(passwordCurrent, currentUser.password))
  ) {
    return next(new AppError('current password invalid', 401));
  }

  // 3) update password
  currentUser.password = password;
  currentUser.passwordConfirm = passwordConfirm;
  await currentUser.save();

  // 4) send token
  createSendToken(currentUser, 200, res);
});
