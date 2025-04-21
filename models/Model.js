const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Part Schema (nested within Model)
const PartSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  uses: {
    type: String,
    default: '',
  },
  model: {
    type: String, // GridFS file ID as string
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Main Model Schema
const ModelSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['Biology', 'Mechanical', 'Electronics', 'Architecture', 'Astronomy'],
    required: true,
  },
  mainModel: {
    type: String, // GridFS file ID as string
    required: true,
  },
  modelCover: {
    type: String, // GridFS file ID as string (for image)
    default: 'default_cover.jpg',
  },
  keyframes: {
    type: String,
    default: '',
  },
  framesPerSecond: {
    type: String,
    default: '24',
  },
  parts: [PartSchema], // Array of parts
  createdAt: {
    type: Date,
    default: Date.now,
  },
  views: {
    type: Number,
    default: 0,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  instructorId: {
    type: Schema.Types.ObjectId, // Reference to the instructor who created it
    ref: 'Instructor',
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  certificateTemplate: {
    type: String,
  },
  completionCriteria: {
    minProgress: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    requiredParts: [{
      type: Schema.Types.ObjectId,
    }],
  },
  difficulty: {
    type: String,
    default: 'Advanced',
  },
  learningPoints: {
    type: [String],
    default: [
      'Visualize complex molecular structures in 3D',
      'Understand atomic bonding and molecular interactions',
      'Learn about molecular symmetry and geometry',
      'Explore different molecular representations',
      'Study the relationship between structure and function',
    ],
  },
});

const Model = mongoose.model('Model', ModelSchema);
module.exports = Model;