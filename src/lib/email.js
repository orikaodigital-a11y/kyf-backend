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

const TRUST_INSTITUTIONS = [
  "IIM Ahmedabad", "IIM Bangalore", "IIM Calcutta", "IIM Kozhikode",
  "IIT Delhi", "IIT Bombay", "IIT Kanpur", "IIT Madras",
];
const trustChips = TRUST_INSTITUTIONS.map(
  (name) => `<span style="display:inline-block;border:1px solid #DCEEF6;background:#F3FAFD;border-radius:8px;padding:5px 10px;margin:3px;font-size:10.5px;font-weight:700;color:#7C93A6;">${name}</span>`
).join("");

// Mirrors the app's Welcome screen (logo, tagline, trusted-by band) - same
// first-impression design, with the verification code standing in for the
// "Start Networking" button.
async function sendOtpEmail(to, code) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `${code} is your Know Your Faculty verification code`,
    html: `
      <div style="max-width:420px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#fff;padding:36px 28px;text-align:center;">
        <img src="${LOGO_URL}" alt="Know Your Faculty" width="260" style="display:block;margin:0 auto 20px;" />
        <p style="font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14.5px;color:#0B5C8C;margin:0 0 26px;">India's First Networking Platform for Educators</p>

        <div style="background:linear-gradient(135deg,#29ABE2,#0B5C8C);border-radius:16px;padding:20px;margin:0 0 16px;">
          <p style="font-size:12px;font-weight:700;color:#fff;opacity:0.9;margin:0 0 8px;letter-spacing:0.3px;">YOUR VERIFICATION CODE</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#fff;margin:0;">${code}</p>
        </div>
        <p style="font-size:12.5px;color:#7C93A6;font-weight:600;margin:0 0 26px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>

        <p style="font-size:11px;color:#7C93A6;margin:0 0 24px;line-height:16px;">
          By continuing, you agree to our <a href="https://knowyourfaculty.com" style="color:#0B5C8C;font-weight:700;text-decoration:underline;">Terms &amp; Conditions</a> and
          <a href="https://knowyourfaculty.com" style="color:#0B5C8C;font-weight:700;text-decoration:underline;">Privacy Policy</a>
        </p>

        <p style="font-size:10.5px;font-weight:700;color:#7C93A6;letter-spacing:0.5px;text-transform:uppercase;margin:0 0 10px;">Trusted by academicians from</p>
        <div>${trustChips}</div>
        <p style="font-size:9.5px;font-weight:600;color:#7C93A6;margin:10px 0 0;">...and more futuremakers joining every week</p>
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
