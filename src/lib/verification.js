// Shared institutional-email check + auto-verify, and the gate middleware
// that blocks Feed/Opportunities access until a professor is verified -
// either automatically (institutional email) or manually (admin-approved
// verification_request for professors without one).
const pool = require("../db");

const personalEmailDomains = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "icloud.com", "protonmail.com", "rediffmail.com", "live.com"
];

function isInstitutionalEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain && !personalEmailDomains.includes(domain);
}

// Auto-verifies if the professor's email looks institutional and they
// aren't already verified. Returns the resulting verified state.
async function ensureAutoVerified(professorId) {
  const result = await pool.query(
    "SELECT email, email_verified FROM professors WHERE id = $1",
    [professorId]
  );
  const professor = result.rows[0];
  if (!professor) return false;
  if (!professor.email_verified && isInstitutionalEmail(professor.email)) {
    await pool.query("UPDATE professors SET email_verified = true WHERE id = $1", [professorId]);
    return true;
  }
  return professor.email_verified;
}

// Route middleware - blocks Feed/Opportunities for unverified professors.
async function requireVerified(req, res, next) {
  try {
    const verified = await ensureAutoVerified(req.professorId);
    if (!verified) {
      return res.status(403).json({
        error: "Verify your email to access this. Institutional (.ac.in/.edu) addresses verify automatically - otherwise, submit a verification request from your profile.",
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
