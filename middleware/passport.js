const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
require('dotenv').config();

passport.serializeUser((user, done) => {
  done(null, user._id ? user._id.toString() : user.id); // Handle both MongoDB and Google users
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (user) {
      done(null, user);
    } else {
      done(null, { id }); // For Google users not stored in DB
    }
  } catch (error) {
    done(error, null);
  }
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ email: profile.emails[0].value });
      
      if (!user) {
        // Create a new user with a random password for Google users
        const randomPassword = Math.random().toString(36).slice(-8);
        user = new User({
          email: profile.emails[0].value,
          fullName: profile.displayName,
          password: randomPassword, // Set a random password for Google users
          googleId: profile.id,
          role: 'learner', // Default role
          preferredLanguage: 'en', // Default language
          isVerified: true // Google accounts are pre-verified
        });
        
        await user.save();
      } else if (!user.googleId) {
        // Link existing user with Google
        user.googleId = profile.id;
        await user.save();
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

module.exports = passport;