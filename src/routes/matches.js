// Fetching your matches — the people you and someone else have both liked.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /matches — everyone you've matched with, most recent first.
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id AS match_id, m.matched_at,
              p.id, p.name, p.title, p.university, p.department, p.photo_url
       FROM matches m
       JOIN professors p
         ON p.id = CASE WHEN m.professor_a_id = $1 THEN m.professor_b_id ELSE m.professor_a_id END
       WHERE m.professor_a_id = $1 OR m.professor_b_id = $1
       ORDER BY m.matched_at DESC`,
      [req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading your matches." });
  }
});

module.exports = router;
