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

async function sendOtpEmail(to, code) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `${code} is your Know Your Faculty verification code`,
    html: `<p>Your verification code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
  if (error) {
    const err = new Error(error.message || "Could not send verification email.");
    err.cause = error;
    throw err;
  }
}

module.exports = { getResend, sendOtpEmail };
