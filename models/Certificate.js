const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
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
  certificateId: {
    type: String,
    unique: true,
    required: true
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  expirationDate: Date,
  verificationUrl: {
    type: String,
    required: true
  },
  metadata: {
    hoursCompleted: Number,
    skillsLearned: [String],
    instructorName: String,
    modelTitle: String
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  revokedReason: String,
  pdfUrl: String,
  shareableUrl: String
}, { timestamps: true });

CertificateSchema.index({ userId: 1, modelId: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', CertificateSchema);