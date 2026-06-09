import nodemailer from 'nodemailer';
import logger from './loggerService.js';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const getOTPEmailHTML = (otp, purpose) => {
  const purposeText = {
    registration:    'verify your email address',
    login:           'confirm your new device login',
    forgot_password: 'reset your password',
    new_device:      'confirm your new device login',
  }[purpose] || 'verify your identity';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CareerPilot OTP</title>
</head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6366f1,#06b6d4);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">⚡ CareerPilot</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your 24/7 AI Career Co-Pilot</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 12px;color:#f1f5f9;font-size:20px;font-weight:700;">Verify your identity</h2>
              <p style="margin:0 0 32px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Use the code below to ${purposeText}. This code expires in <strong style="color:#f1f5f9;">2 minutes</strong>.
              </p>
              <!-- OTP Box -->
              <div style="background:#0a0a12;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Your verification code</p>
                <p style="margin:0;color:#ffffff;font-size:42px;font-weight:800;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
              </div>
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;line-height:1.6;">
                ⚠️ Never share this code with anyone. CareerPilot will never ask for your OTP.
              </p>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                © ${new Date().getFullYear()} CareerPilot · Dhaka, Bangladesh 🇧🇩
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const sendOTPEmail = async (email, otp, purpose) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('SMTP not configured — OTP email skipped', { email, otp, purpose });
    logger.info(`[DEV MODE] OTP for ${email}: ${otp}`);
    return true;
  }

  try {
    const transporter = createTransporter();
    const purposeSubject = {
      registration:    'Verify your CareerPilot account',
      login:           'CareerPilot — New device login',
      forgot_password: 'Reset your CareerPilot password',
      new_device:      'CareerPilot — New device detected',
    }[purpose] || 'CareerPilot — Verification code';

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'CareerPilot <noreply@careerpilot.app>',
      to:      email,
      subject: purposeSubject,
      html:    getOTPEmailHTML(otp, purpose),
    });

    logger.info('OTP email sent', { email, purpose });
    return true;
  } catch (err) {
    logger.error('Failed to send OTP email', { email, purpose, error: err.message });
    return false;
  }
};

export const sendWelcomeEmail = async (email, name) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('SMTP not configured — welcome email skipped');
    return true;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'CareerPilot <noreply@careerpilot.app>',
      to:      email,
      subject: 'Welcome to CareerPilot 🚀',
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6366f1,#06b6d4);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">⚡ CareerPilot</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:22px;">Welcome, ${name}! 🎉</h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
                Your CareerPilot account is ready. Start by uploading your CV to get your ATS score and see how you match against real jobs from LinkedIn, Indeed, and Bdjobs.
              </p>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
                Go to Dashboard →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} CareerPilot · Dhaka, Bangladesh 🇧🇩</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    logger.info('Welcome email sent', { email });
    return true;
  } catch (err) {
    logger.error('Failed to send welcome email', { email, error: err.message });
    return false;
  }
};
