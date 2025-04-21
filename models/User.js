const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['learner', 'instructor', 'admin'], 
    default: null 
  },
  googleId: {
    type: String,
    sparse: true
  },
  preferredLanguage: {
    type: String,
    default: 'en'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    code: String,
    expiresAt: Date
  },
  profilePicture: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model' 
  }],
  createdCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model' 
  }],
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model' 
  }],
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};


userSchema.add({       
  certificates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate'
  }],
  completedModels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model'
  }],
  purchases: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }],
  learningProgress: {
    type: Map,
    of: Number,
    default: {}
  }
});
const User = mongoose.model('User', userSchema);

module.exports = User;