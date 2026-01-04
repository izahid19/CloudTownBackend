import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined for OAuth users
    lowercase: true,
  },
  password: {
    type: String, // bcrypt hashed, only for email auth users
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  authProvider: {
    type: String,
    enum: ['email', 'discord', 'google'],
    default: 'email',
  },
  about: String,
  linkedin: String,
  twitter: String,
  portfolio: String,
  github: String,
  lastSeen: {
    type: Date,
    default: Date.now,
  },
});

export const User = mongoose.model('User', UserSchema);
