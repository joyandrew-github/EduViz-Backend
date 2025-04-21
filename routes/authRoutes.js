const express = require('express');
const passport = require('../middleware/passport');
const { logout,
   authStatus, 
   getUser, 
   sendOTP, 
   verifyOTP, 
   signup, 
   login, 
   selectRole,
   updateCreatedCourses,
   updateEnrolledCourses,
   updateWishlist,
   getUserData,
   removeWishlist,
   uploadProfilePicture,
   updateUserProfile } = require('../controllers/authController');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Serve static files from uploads directory
router.use('/uploads/profile-pictures', express.static(path.join(__dirname, '../uploads/profile-pictures')));

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/profile-pictures');
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

// Middleware to verify JWT
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

router.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login` }),
  (req, res) => {
    // Generate JWT token for Google OAuth user
    const user = req.user;
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );

    // Redirect to dashboard with token in query string (or use a different method)
    res.redirect(`${process.env.CLIENT_URL}/learner?token=${token}`);
  }
);

router.get('/auth/logout', logout);
router.get('/auth/status', authStatus);
router.get('/api/user', getUser);
router.post('/api/send-otp', sendOTP);
router.post('/api/verify-otp', verifyOTP);
router.post('/api/signup', signup);
router.post('/api/login', login);
router.post('/api/select-role', authenticateJWT, selectRole);
router.post('/api/users/update-created-courses', authenticateJWT, updateCreatedCourses);
router.post('/api/users/enroll', authenticateJWT, updateEnrolledCourses);
router.post('/api/users/wishlist', authenticateJWT, updateWishlist);
router.get('/api/users/me', authenticateJWT, getUserData);
router.put('/api/users/me', authenticateJWT, updateUserProfile);
router.put('/api/users/wishlist/remove/:modelId', authenticateJWT, removeWishlist);
router.post('/api/auth/upload-profile-image', authenticateJWT, upload.single('profileImage'), uploadProfilePicture);
module.exports = router;