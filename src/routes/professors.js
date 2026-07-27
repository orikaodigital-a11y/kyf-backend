// Routes for professor profile data. We start with just "get my own profile" —
// this is the simplest possible route that proves login + tokens are working end-to-end.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /professors/me  — requires a valid login token
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, university, department, category, email, username, email_verified, wallet_balance_paise FROM professors WHERE id = $1",
      [req.professorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong fetching your profile." });
  }
});

// GET /professors/:id/status — public check, just verification status
// (Temporary: once real login sessions exist, use /me instead)
router.get("/:id/status", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT email_verified FROM professors WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json({ verified: result.rows[0].email_verified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});


// GET /professors/:id — public profile view (no email, no password)
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, university, department, category, username, email_verified, bio, tags, seeking, title, photo_url FROM professors WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});
module.exports = router;
