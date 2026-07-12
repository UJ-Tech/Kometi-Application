// src/services/email.service.ts
// Nodemailer-based email sender with a branded HTML OTP template.

import nodemailer from "nodemailer";
import env from "../config/env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

function buildOTPEmail(otp: string, userName: string, appName = "Monio"): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="440" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:32px 24px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${appName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;">
              <p style="margin:0 0 8px;font-size:16px;color:#1c1917;font-weight:600;">Hi ${userName},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#78716c;line-height:1.6;">
                Use the following one-time password to verify your email address. This code is valid for <strong>5 minutes</strong>.
              </p>
              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f5;border-radius:12px;border:1px solid #e8e4df;margin-bottom:24px;">
                <tr>
                  <td align="center" style="padding:24px 16px;">
                    <span style="font-size:36px;font-weight:800;color:#4f46e5;letter-spacing:8px;font-family:Menlo,monospace;">${otp}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:13px;color:#a8a29e;line-height:1.5;">
                If you didn't request this verification, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:13px;color:#a8a29e;">
                Thanks,<br>The ${appName} Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #e8e4df;">
              <p style="margin:0;font-size:11px;color:#a8a29e;text-align:center;">
                ${appName} &mdash; Safe. Transparent. Reliable.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmailOTP(
  to: string,
  userName: string,
  otp: string,
): Promise<void> {
  const html = buildOTPEmail(otp, userName);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: `Your OTP for Email Verification - Monio`,
    html,
  });
}
