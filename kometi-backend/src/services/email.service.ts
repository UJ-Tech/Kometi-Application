// src/services/email.service.ts
// Sends emails via Brevo (Sendinblue) REST API — HTTPS, never blocked by cloud hosts.

import https from "https";
import env from "../config/env";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

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
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:32px 24px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${appName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              <p style="margin:0 0 8px;font-size:16px;color:#1c1917;font-weight:600;">Hi ${userName},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#78716c;line-height:1.6;">
                Use the following one-time password to verify your email address. This code is valid for <strong>5 minutes</strong>.
              </p>
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

function postToBrevo(payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(BREVO_API_URL);
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY!,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            const message =
              (() => {
                try {
                  return JSON.parse(body).message;
                } catch {
                  return body;
                }
              })() || res.statusMessage || `HTTP ${res.statusCode}`;
            reject(new Error(message));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export async function sendEmailOTP(
  to: string,
  userName: string,
  otp: string,
): Promise<void> {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    console.log(`[Email OTP] Brevo not configured. OTP for ${to}: ${otp}`);
    return;
  }

  console.log(`[Email OTP] Sending to ${to} via Brevo...`);

  try {
    await postToBrevo({
      sender: {
        name: env.BREVO_SENDER_NAME || "Monio",
        email: env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to, name: userName }],
      subject: "Your OTP for Email Verification - Monio",
      htmlContent: buildOTPEmail(otp, userName),
    });
    console.log(`[Email OTP] Sent successfully to ${to}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Email OTP] Brevo error: ${message}`);
    console.log(`[Email OTP] OTP for ${to}: ${otp}`);
    throw new Error(`Failed to send email: ${message}`);
  }
}
