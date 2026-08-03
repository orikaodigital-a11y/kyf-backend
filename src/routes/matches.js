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
              p.id, p.name, p.title, p.university, p.department, p.photo_url,
              lm.body AS last_message, lm.created_at AS last_message_at,
              EXISTS (
                SELECT 1 FROM messages um
                WHERE um.match_id = m.id AND um.sender_id != $1 AND um.read_at IS NULL
              ) AS unread
       FROM matches m
       JOIN professors p
         ON p.id = CASE WHEN m.professor_a_id = $1 THEN m.professor_b_id ELSE m.professor_a_id END
       LEFT JOIN LATERAL (
         SELECT body, created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE m.professor_a_id = $1 OR m.professor_b_id = $1
       ORDER BY COALESCE(lm.created_at, m.matched_at) DESC`,
      [req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading your matches." });
  }
});

// DELETE /matches/:matchId — unmatch. Deletes the match (messages cascade with it).
router.delete("/:matchId", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM matches
       WHERE id = $1 AND (professor_a_id = $2 OR professor_b_id = $2)
       RETURNING id`,
      [req.params.matchId, req.professorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Match not found." });
    }
    res.json({ unmatched: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong ending that match." });
  }
});

module.exports = router;
