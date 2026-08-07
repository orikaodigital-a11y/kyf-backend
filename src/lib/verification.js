// The gate middleware that blocks Feed/Discover/Matches/Opportunities access
// until a professor is verified. A professor becomes verified only at the
// moment they prove ownership of their email via a real OTP (see
// lib/emailOtp.js) - at signup, or when adding/updating their email later -
// or via an admin-approved manual verification_request. Once set, the
// professors.email_verified column is the permanent record; this file never
// upgrades it from a domain guess alone.
const pool = require("../db");

const personalEmailDomains = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "icloud.com", "protonmail.com", "rediffmail.com", "live.com"
];

function isInstitutionalEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain && !personalEmailDomains.includes(domain);
}

// Reads the professor's current verified state - does not grant it.
async function ensureAutoVerified(professorId) {
  const result = await pool.query("SELECT email_verified FROM professors WHERE id = $1", [professorId]);
  return result.rows[0]?.email_verified || false;
}

// Route middleware - blocks Feed/Discover/Matches/Opportunities for unverified professors.
async function requireVerified(req, res, next) {
  try {
    const verified = await ensureAutoVerified(req.professorId);
    if (!verified) {
      return res.status(403).json({
        error: "Verify your email to access this. Add/verify an institutional (.ac.in/.edu) email from your profile, or submit a verification request if you don't have one.",
        code: "NOT_VERIFIED",
      });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong checking your verification status." });
  }
}

module.exports = { isInstitutionalEmail, ensureAutoVerified, requireVerified };
