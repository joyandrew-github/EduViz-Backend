const Message = require('../models/Message');

// Save a new message
exports.saveMessage = async (req, res) => {
  try {
    const { courseId } = req.params;
    const message = new Message({
      ...req.body,
      courseId,
      timestamp: new Date()
    });

    const savedMessage = await message.save();
    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
};

// Get messages for a course
exports.getMessages = async (req, res) => {
  try {
    const { courseId } = req.params;
    const messages = await Message.find({ courseId })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}; 