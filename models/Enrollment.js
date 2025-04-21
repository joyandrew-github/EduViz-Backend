const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: true
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastAccessed: Date,
  completedParts: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  completionDate: Date
}, { timestamps: true });

EnrollmentSchema.index({ userId: 1, modelId: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);