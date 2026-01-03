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
