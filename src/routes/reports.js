// Reporting another professor's profile.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const VALID_REASONS = ["spam", "duplicate", "fake", "inappropriate", "other"];

// POST /reports — Body: { reportedId, reason, details }
router.post("/", requireAuth, async (req, res) => {
  const { reportedId, reason, details } = req.body;
  if (!reportedId || !VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: "Please choose who and why you're reporting." });
  }
  if (reportedId === req.professorId) {
    return res.status(400).json({ error: "You can't report your own profile." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO reports (reported_id, reporter_id, reason, details)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [reportedId, req.professorId, reason, details || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong submitting your report." });
  }
});

module.exports = router;
