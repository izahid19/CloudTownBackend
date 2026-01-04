const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

/**
 * Send email using Brevo API
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.FROM_NAME || 'CloudTown',
          email: process.env.FROM_EMAIL,
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Brevo API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send OTP verification email
 */
export async function sendOTPEmail(to: string, otp: string): Promise<boolean> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .logo { text-align: center; font-size: 32px; margin-bottom: 20px; }
        h1 { color: #333; text-align: center; margin-bottom: 10px; }
        .subtitle { color: #666; text-align: center; margin-bottom: 30px; }
        .otp-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px; margin: 20px 0; }
        .note { color: #888; font-size: 14px; text-align: center; margin-top: 20px; }
        .footer { color: #aaa; font-size: 12px; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">☁️</div>
        <h1>Welcome to Cloud Town!</h1>
        <p class="subtitle">Enter this code to verify your email</p>
        <div class="otp-box">${otp}</div>
        <p class="note">This code expires in 10 minutes.<br>If you didn't request this, please ignore this email.</p>
        <p class="footer">© ${new Date().getFullYear()} Cloud Town - A multiplayer virtual world</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: '☁️ Your Cloud Town Verification Code',
    htmlContent,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .logo { text-align: center; font-size: 32px; margin-bottom: 20px; }
        h1 { color: #333; text-align: center; margin-bottom: 10px; }
        .subtitle { color: #666; text-align: center; margin-bottom: 30px; }
        .btn { display: block; width: 200px; margin: 20px auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; text-align: center; padding: 15px 30px; border-radius: 8px; font-weight: bold; }
        .note { color: #888; font-size: 14px; text-align: center; margin-top: 20px; }
        .footer { color: #aaa; font-size: 12px; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">☁️</div>
        <h1>Reset Your Password</h1>
        <p class="subtitle">Click the button below to set a new password</p>
        <a href="${resetUrl}" class="btn">Reset Password</a>
        <p class="note">This link expires in 1 hour.<br>If you didn't request this, please ignore this email.</p>
        <p class="footer">© ${new Date().getFullYear()} Cloud Town - A multiplayer virtual world</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: '☁️ Reset Your Cloud Town Password',
    htmlContent,
  });
}
