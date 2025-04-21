const express = require('express');
const { preloadData, chat } = require('../controllers/chatController');
const router = express.Router();

router.post('/preload', preloadData);
router.post('/chat', chat);

module.exports = router;