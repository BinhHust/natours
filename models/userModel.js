const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Schema -> Model -> create user (sign in) -> login -> protected
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    require: [true, 'A user must have a name'],
  },
  email: {
    type: String,
    require: [true, 'A user must have an email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Email invalid'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  password: {
    type: String,
    minlength: 8,
    require: [true, 'A user must have a password'],
    select: false,
  },
  passwordConfirm: {
    type: String,
    require: [true, 'A user must have a password confirm'],
    validate: {
      validator: function (val) {
        return val === this.password;
      },
      message: 'Password and password confirm must be the same',
    },
  },
  changedPasswordAt: Date,
  passwordResetToken: String,
  passwordResetExpired: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
});

// DOCUMENT MIDDLEWWARE

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // tao moi + pw updated
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;

  next();
});

userSchema.pre('save', function (next) {
  if (this.isNew || !this.isModified('password')) return next();

  // pw updated
  // - 1000 de dam bao rang thoi gian update xay ra trc khi token dc tao
  this.changedPasswordAt = Date.now() - 1000;

  next();
});

// QUERY MIDDLEWWARE
userSchema.pre(/^find/, function (next) {
  this.find({ active: true });
  next();
});

// METHODS
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.changedPasswordAt) {
    const changedTimestamp = parseInt(this.changedPasswordAt / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetTokenUnencrypt = crypto.randomBytes(32).toString('hex');

  const resetTokenEncrypt = crypto
    .createHash('sha256')
    .update(resetTokenUnencrypt)
    .digest('hex');

  this.passwordResetToken = resetTokenEncrypt;
  this.passwordResetExpired = Date.now() + 10 * 60 * 1000;

  return resetTokenUnencrypt;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
