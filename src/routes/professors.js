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

module.exports = router;
