const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const multer = require('multer');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/messages';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Image upload endpoint
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Return the URL of the uploaded image
    const imageUrl = `/uploads/messages/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get all messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ timestamp: 1 })
      .limit(100); // Limit to last 100 messages
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get all conversations (for instructor view)
router.get('/conversations/all', async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $group: {
          _id: '$courseId',
          messages: { $push: '$$ROOT' },
          lastMessage: { $last: '$text' },
          timestamp: { $last: '$timestamp' },
          unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } }
        }
      },
      {
        $project: {
          courseId: '$_id',
          messages: 1,
          lastMessage: 1,
          timestamp: 1,
          unread: 1
        }
      }
    ]);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get all messages for a specific course
router.get('/:courseId', async (req, res) => {
  try {
    const messages = await Message.find({ courseId: req.params.courseId })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Save a new message
router.post('/:courseId?', async (req, res) => {
  try {
    const { sender, text, image, userId } = req.body;
    const courseId = req.params.courseId || 'direct-messaging';
    
    const message = new Message({
      courseId,
      sender,
      userId,
      text,
      image,
      timestamp: new Date()
    });
    
    const savedMessage = await message.save();
    console.log('Message saved:', savedMessage);
    
    // Emit the message through Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('new-message', savedMessage);
    }
    
    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

module.exports = router; 