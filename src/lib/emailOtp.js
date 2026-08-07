// Server-side email OTP: generate + store a code, send it via Resend, and
// verify what the user types back against what's actually stored - never
// trust a code the client claims to have generated itself.
const pool = require("../db");
const { sendOtpEmail } = require("./email");

const OTP_TTL_MINUTES = 10;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function issueEmailOtp(email) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await pool.query(
    `INSERT INTO email_otps (email, code, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3, created_at = now()`,
    [email, code, expiresAt]
  );
  await sendOtpEmail(email, code);
}

const VERIFIED_SENTINEL = "__verified__";
const VERIFIED_GRACE_MINUTES = 30;

// Returns true/false. On success, the row is converted into a short-lived
// "verified" marker (rather than deleted outright) so a signup/email-update
// request that follows shortly after can confirm this exact email was
// actually proven, not just claimed by the client.
async function checkEmailOtp(email, code) {
  const result = await pool.query(
    "SELECT code, expires_at FROM email_otps WHERE email = $1",
    [email]
  );
  const row = result.rows[0];
  if (!row) return false;
  if (row.code === VERIFIED_SENTINEL) return false; // already consumed, not a live code
  if (new Date(row.expires_at) < new Date()) return false;
  if (row.code !== String(code).trim()) return false;

  const graceExpiry = new Date(Date.now() + VERIFIED_GRACE_MINUTES * 60 * 1000);
  await pool.query(
    "UPDATE email_otps SET code = $1, expires_at = $2 WHERE email = $3",
    [VERIFIED_SENTINEL, graceExpiry, email]
  );
  return true;
}

// Used server-side (signup, email update) to confirm this email was
// genuinely OTP-verified recently, rather than trusting the client's word.
async function wasEmailRecentlyVerified(email) {
  const result = await pool.query(
    "SELECT code, expires_at FROM email_otps WHERE email = $1",
    [email]
  );
  const row = result.rows[0];
  if (!row || row.code !== VERIFIED_SENTINEL) return false;
  return new Date(row.expires_at) >= new Date();
}

module.exports = { issueEmailOtp, checkEmailOtp, wasEmailRecentlyVerified };
