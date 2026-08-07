// Built lazily (not at module load) so a missing/misconfigured Resend key
// only breaks email-OTP routes when they're actually called, instead of
// crashing the entire server on startup - same pattern as lib/razorpay.js.
const { Resend } = require("resend");

let instance = null;

function getResend() {
  if (!instance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set.");
    }
    instance = new Resend(process.env.RESEND_API_KEY);
  }
  return instance;
}

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "Know Your Faculty <onboarding@resend.dev>";
const LOGO_URL = "https://ihliqntaxatuuzweyasn.supabase.co/storage/v1/object/public/kyf-uploads/branding/kyf-logo.png";

// Mirrors the app's Welcome screen (logo, tagline, verification code in
// place of the "Start Networking" button), wrapped in a phone-frame mockup
// so it reads as an actual app screenshot rather than a plain email.
async function sendOtpEmail(to, code) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `${code} is your Know Your Faculty verification code`,
    html: `
      <div style="background:#F3FAFD;padding:40px 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
        <div style="display:inline-block;background:#0B1220;border-radius:36px;padding:14px;">
          <div style="width:70px;height:16px;background:#0B1220;border-radius:0 0 10px 10px;margin:0 auto 6px;"></div>
          <div style="background:#fff;border-radius:24px;padding:34px 24px;width:300px;">
            <img src="${LOGO_URL}" alt="Know Your Faculty" width="220" style="display:block;margin:0 auto 18px;" />
            <p style="font-weight:700;font-size:13px;color:#0B5C8C;margin:0 0 24px;">India's First Networking Platform for Educators</p>

            <div style="background:linear-gradient(135deg,#29ABE2,#0B5C8C);border-radius:16px;padding:18px;margin:0 0 16px;">
              <p style="font-size:11px;font-weight:700;color:#fff;opacity:0.9;margin:0 0 8px;letter-spacing:0.3px;">YOUR VERIFICATION CODE</p>
              <p style="font-size:28px;font-weight:700;letter-spacing:7px;color:#fff;margin:0;">${code}</p>
            </div>
            <p style="font-size:11.5px;color:#7C93A6;font-weight:600;margin:0 0 20px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>

            <p style="font-size:10px;color:#7C93A6;margin:0;line-height:15px;">
              By continuing, you agree to our <a href="https://knowyourfaculty.com" style="color:#0B5C8C;font-weight:700;text-decoration:underline;">Terms &amp; Conditions</a> and
              <a href="https://knowyourfaculty.com" style="color:#0B5C8C;font-weight:700;text-decoration:underline;">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    `,
  });
  if (error) {
    const err = new Error(error.message || "Could not send verification email.");
    err.cause = error;
    throw err;
  }
}

module.exports = { getResend, sendOtpEmail };
