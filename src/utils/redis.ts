import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const RATE_LIMIT_SECONDS = 120; // 2 minutes

/**
 * Store OTP in Redis with expiry
 */
export async function setOTP(email: string, otp: string): Promise<void> {
  const key = `otp:${email.toLowerCase()}`;
  await redis.set(key, otp, { ex: OTP_EXPIRY_SECONDS });
  
  // Also set rate limit key
  const rateLimitKey = `otp_rate:${email.toLowerCase()}`;
  await redis.set(rateLimitKey, '1', { ex: RATE_LIMIT_SECONDS });
}

/**
 * Get OTP from Redis
 */
export async function getOTP(email: string): Promise<string | null> {
  const key = `otp:${email.toLowerCase()}`;
  return await redis.get(key);
}

/**
 * Delete OTP from Redis (after successful verification)
 */
export async function deleteOTP(email: string): Promise<void> {
  const key = `otp:${email.toLowerCase()}`;
  await redis.del(key);
}

/**
 * Check if user can request new OTP (rate limiting)
 * Returns remaining cooldown in seconds, or 0 if can resend
 */
export async function getResendCooldown(email: string): Promise<number> {
  const rateLimitKey = `otp_rate:${email.toLowerCase()}`;
  const ttl = await redis.ttl(rateLimitKey);
  return ttl > 0 ? ttl : 0;
}

/**
 * Store password reset token
 */
export async function setResetToken(email: string, token: string): Promise<void> {
  const key = `reset:${token}`;
  await redis.set(key, email.toLowerCase(), { ex: 3600 }); // 1 hour expiry
}

/**
 * Get email from reset token
 */
export async function getResetTokenEmail(token: string): Promise<string | null> {
  const key = `reset:${token}`;
  return await redis.get(key);
}

/**
 * Delete reset token after use
 */
export async function deleteResetToken(token: string): Promise<void> {
  const key = `reset:${token}`;
  await redis.del(key);
}

/**
 * Generate 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate random token for password reset
 */
export function generateResetToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default redis;
