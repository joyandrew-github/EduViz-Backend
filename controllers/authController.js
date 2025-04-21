const { generateOTP, sendOTPEmail } = require('../services/emailService');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Temporary OTP storage (use Redis in production)
const otpStore = new Map();

const logout = (req, res) => {
  req.logout(() => {
    res.redirect(process.env.CLIENT_URL);
  });
};

const authStatus = (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ isAuthenticated: true, user: req.user });
  } else {
    res.json({ isAuthenticated: false });
  }
};

const getUser = (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
};

const sendOTP = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const otp = generateOTP();
  otpStore.set(email, {
    otp,
    timestamp: Date.now(),
    attempts: 0
  });

  const sent = await sendOTPEmail(email, otp);
  
  if (sent) {
    res.json({ message: 'OTP sent successfully' });
  } else {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

const verifyOTP = (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const storedData = otpStore.get(email);
  
  if (!storedData) {
    return res.status(400).json({ error: 'No OTP found for this email' });
  }

  if (Date.now() - storedData.timestamp > 10 * 60 * 1000) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (storedData.attempts >= 3) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'Too many attempts. Please request a new OTP' });
  }

  if (storedData.otp === otp) {
    otpStore.delete(email);
    res.json({ message: 'OTP verified successfully' });
  } else {
    storedData.attempts++;
    res.status(400).json({ error: 'Invalid OTP' });
  }
};

const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({
      fullName,
      email,
      password,
      preferredLanguage: 'en',
      isVerified: true
    });
    
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({ 
      message: 'User registered successfully. Please select your role.', 
      token, 
      userId: user._id 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login attempt failed: User not found', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is a Google-authenticated user
    if (user.googleId) {
      console.log('Login attempt failed: Google user tried password login', { email });
      return res.status(401).json({ 
        error: 'This account was created using Google. Please use Google Sign-In instead.' 
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Login attempt failed: Invalid password', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('Login successful', { email, userId: user._id });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role // Include role (could be null if not selected)
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );

    // If Passport session is available, use it (for compatibility with Google OAuth flow)
    if (typeof req.login === 'function') {
      req.login(user, (err) => {
        if (err) {
          console.error('Passport login error:', err);
          // Fall back to JWT response
          return res.json({ 
            message: 'Logged in successfully', 
            token,
            user: { 
              id: user._id,
              email: user.email, 
              fullName: user.fullName,
              role: user.role,
              preferredLanguage: user.preferredLanguage
            } 
          });
        }
        // Return token even with Passport session for consistency
        res.json({ 
          message: 'Logged in successfully', 
          token, // Include token for frontend flexibility
          user: { 
            id: user._id,
            email: user.email, 
            fullName: user.fullName,
            role: user.role,
            preferredLanguage: user.preferredLanguage
          } 
        });
      });
    } else {
      // No Passport session, use JWT directly
      res.json({ 
        message: 'Logged in successfully', 
        token,
        user: { 
          id: user._id,
          email: user.email, 
          fullName: user.fullName,
          role: user.role,
          preferredLanguage: user.preferredLanguage
        } 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
};

const selectRole = async (req, res) => {
  const { role } = req.body;
  const userId = req.user.id;

  if (!role || !['learner', 'instructor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role) {
      return res.status(400).json({ error: 'Role already assigned' });
    }

    user.role = role;
    if (role === 'learner') {
      user.createdCourses = [];
    } else if (role === 'instructor') {
      user.enrolledCourses = [];
    }

    await user.save();

    // Generate a new token with updated role
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );

    res.json({
      message: 'Role assigned successfully',
      token, // Return the new token
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdCourses: user.createdCourses || [] // Include createdCourses
      }
    });
  } catch (error) {
    console.error('Role selection error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
};
const updateCreatedCourses = async (req, res) => {
  const { modelId } = req.body;
  const userId = req.user.id; // From JWT middleware

  if (!modelId) {
    return res.status(400).json({ error: 'Model ID is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add modelId to createdCourses if not already present
    if (!user.createdCourses.includes(modelId)) {
      user.createdCourses.push(modelId);
      await user.save();
    }

    res.json({ message: 'Created courses updated successfully' });
  } catch (error) {
    console.error('Error updating created courses:', error);
    res.status(500).json({ error: 'Failed to update created courses' });
  }
};

const updateEnrolledCourses = async (req, res) => {
  const { modelId } = req.body;
  const userId = req.user.id; // From JWT middleware

  if (!modelId) {
    return res.status(400).json({ error: 'Model ID is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'learner') {
      return res.status(403).json({ error: 'Only learners can enroll in courses' });
    }

    // Check if modelId is already in enrolledCourses
    if (user.enrolledCourses.includes(modelId)) {
      return res.status(400).json({ error: 'Course already enrolled' });
    }

    // Add modelId to enrolledCourses
    user.enrolledCourses.push(modelId);
    await user.save();

    res.json({ message: 'Course enrolled successfully' });
  } catch (error) {
    console.error('Error updating enrolled courses:', error);
    res.status(500).json({ error: 'Failed to enroll course' });
  }
};
const updateWishlist = async (req, res) => {
  const { modelId } = req.body;
  const userId = req.user.id; // From JWT middleware

  if (!modelId) {
    return res.status(400).json({ error: 'Model ID is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if modelId is already in wishlist
    if (user.wishlist.includes(modelId)) {
      return res.status(400).json({ error: 'Model already in wishlist' });
    }

    // Add modelId to wishlist
    user.wishlist.push(modelId);
    await user.save();

    res.json({ message: 'Model added to wishlist successfully' });
  } catch (error) {
    console.error('Error updating wishlist:', error);
    res.status(500).json({ error: 'Failed to update wishlist' });
  }
};
const removeWishlist = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const modelId = req.params.modelId;

    // Find and update the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove modelId from wishlist if it exists
    const index = user.wishlist.indexOf(modelId);
    if (index > -1) {
      user.wishlist.splice(index, 1);
      await user.save();
      res.json({ message: "Model removed from wishlist", wishlist: user.wishlist });
    } else {
      res.status(400).json({ message: "Model not in wishlist" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
const getUserData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('enrolledCourses wishlist role fullName email preferredLanguage profilePicture');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user's profile picture
    user.profilePicture = req.file.filename;
    await user.save();

    res.json({ 
      message: 'Profile picture uploaded successfully',
      profilePicture: req.file.filename
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profilePicture, fullName, email, preferredLanguage } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update only the provided fields
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        preferredLanguage: user.preferredLanguage
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = { logout, authStatus, getUser, sendOTP, verifyOTP, signup, login, selectRole, updateCreatedCourses, updateEnrolledCourses, updateWishlist, removeWishlist, getUserData, uploadProfilePicture, updateUserProfile };