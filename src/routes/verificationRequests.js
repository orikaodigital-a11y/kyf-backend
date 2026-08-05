// Professor-facing routes for manual verification (no institutional email).
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /verification-requests — Body: { message, proofUrl }
router.post("/", requireAuth, async (req, res) => {
  const { message, proofUrl } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Please describe who you are." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO verification_requests (professor_id, message, proof_url)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.professorId, message.trim(), proofUrl?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong submitting your request." });
  }
});

// GET /verification-requests/me — most recent request, if any.
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM verification_requests WHERE professor_id = $1 ORDER BY created_at DESC LIMIT 1",
      [req.professorId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;
