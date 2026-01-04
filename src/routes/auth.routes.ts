import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { 
  setOTP, 
  getOTP, 
  deleteOTP, 
  getResendCooldown, 
  generateOTP,
  setResetToken,
  getResetTokenEmail,
  deleteResetToken,
  generateResetToken
} from '../utils/redis';
import { sendOTPEmail, sendPasswordResetEmail } from '../utils/email';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cloudtown-jwt-secret-change-in-production';

// Helper to generate JWT
function generateJWT(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * POST /api/auth/register
 * Register new user with email/password
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.isVerified) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }
      // If not verified, allow re-registration (update details)
      const hashedPassword = await bcrypt.hash(password, 10);
      existingUser.username = username;
      existingUser.password = hashedPassword;
      await existingUser.save();
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      await User.create({
        userId,
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        isVerified: false,
        authProvider: 'email',
      });
    }

    // Generate and send OTP
    const otp = generateOTP();
    await setOTP(email, otp);
    const emailSent = await sendOTPEmail(email, otp);

    if (!emailSent) {
      res.status(500).json({ error: 'Failed to send verification email' });
      return;
    }

    res.status(200).json({ 
      message: 'Verification code sent to your email',
      email: email.toLowerCase()
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and activate account
 */
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ error: 'Email and OTP are required' });
      return;
    }

    const storedOTP = await getOTP(email);
    
    if (!storedOTP) {
      res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
      return;
    }

    if (String(storedOTP).trim() !== String(otp).trim()) {
      res.status(400).json({ error: 'Invalid OTP' });
      return;
    }

    // Mark user as verified
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete used OTP
    await deleteOTP(email);

    // Generate JWT token
    const token = generateJWT(user.userId, email);

    res.status(200).json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/resend-otp
 * Resend OTP (rate limited to once per 2 minutes)
 */
router.post('/resend-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Check rate limit
    const cooldown = await getResendCooldown(email);
    if (cooldown > 0) {
      res.status(429).json({ 
        error: `Please wait ${cooldown} seconds before requesting a new code`,
        cooldown
      });
      return;
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ error: 'Email already verified' });
      return;
    }

    // Generate and send new OTP
    const otp = generateOTP();
    await setOTP(email, otp);
    const emailSent = await sendOTPEmail(email, otp);

    if (!emailSent) {
      res.status(500).json({ error: 'Failed to send verification email' });
      return;
    }

    res.status(200).json({ message: 'New verification code sent' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.authProvider !== 'email') {
      res.status(400).json({ error: `This account uses ${user.authProvider} sign-in` });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({ 
        error: 'Email not verified',
        needsVerification: true,
        email: user.email
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password || '');
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT
    const token = generateJWT(user.userId, email);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Don't reveal if user exists
    if (!user || user.authProvider !== 'email') {
      res.status(200).json({ message: 'If the email exists, a reset link has been sent' });
      return;
    }

    // Generate reset token
    const resetToken = generateResetToken();
    await setResetToken(email, resetToken);
    
    await sendPasswordResetEmail(email, resetToken);

    res.status(200).json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const email = await getResetTokenEmail(token);
    
    if (!email) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete used token
    await deleteResetToken(token);

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * GET /api/auth/me
 * Get current user from JWT token
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      
      const user = await User.findOne({ userId: decoded.userId });
      
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({
        user: {
          id: user.userId,
          username: user.username,
          email: user.email,
          name: user.username,
          image: undefined, // Email users don't have Discord avatar
        }
      });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
