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

async function sendOtpEmail(to, code) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `${code} is your Know Your Faculty verification code`,
    html: `
      <div style="max-width:420px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
        <div style="background:linear-gradient(135deg,#29ABE2,#0B5C8C);padding:24px;text-align:center;border-radius:12px 12px 0 0;">
          <div style="background:#fff;display:inline-block;padding:12px 20px;border-radius:10px;">
            <img src="${LOGO_URL}" alt="Know Your Faculty" width="170" style="display:block;" />
          </div>
        </div>
        <div style="background:#fff;padding:28px 24px;border:1px solid #E5E9EC;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:14px;color:#333;margin:0 0 16px;">Your verification code is:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0B5C8C;margin:0 0 16px;">${code}</p>
          <p style="font-size:12.5px;color:#888;margin:0;">It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
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
