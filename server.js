require('dotenv').config(); // Load environment variables first
const app = require('./app');
require('./config/db'); // Initialize database connection
const http = require('http');
const socketIo = require('socket.io');

const port = 8080;
const server = http.createServer(app);

// Configure Socket.IO with proper CORS settings
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:8080"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Make io accessible to our router
app.set('io', io);

// Store active users
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle user joining
  socket.on('join', (data) => {
    const { userType, userId } = data;
    console.log(`User joined as ${userType}:`, socket.id);
    
    // Store user info
    activeUsers.set(socket.id, { userType, userId, socketId: socket.id });
    
    // Notify others of online status
    io.emit('user-status', Array.from(activeUsers.values()));
  });

  // Handle instructor messages
  socket.on('instructor-message', (message) => {
    console.log('Instructor message received:', message);
    // Broadcast to all clients including sender
    io.emit('new-message', message);
  });

  // Handle student messages
  socket.on('student-message', (message) => {
    console.log('Student message received:', message);
    // Broadcast to all clients including sender
    io.emit('new-message', message);
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const senderInfo = activeUsers.get(socket.id);
    if (senderInfo) {
      socket.broadcast.emit('typing', {
        ...data,
        userId: senderInfo.userId
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      console.log(`User disconnected:`, socket.id);
      
      // Remove from active users
      activeUsers.delete(socket.id);
      
      // Notify others of updated online status
      io.emit('user-status', Array.from(activeUsers.values()));
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('WebSocket server is ready');
});