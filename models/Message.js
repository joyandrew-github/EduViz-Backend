const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  courseId: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    required: true,
    enum: ['student', 'instructor']
  },
  text: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create index for better query performance
messageSchema.index({ timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema); 