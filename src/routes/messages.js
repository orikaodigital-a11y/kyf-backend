// Chat between two matched professors. A thread is identified by its match id —
// only the two professors in that match may read or post to it.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

async function loadMatchForUser(matchId, professorId) {
  const result = await pool.query(
    `SELECT m.*, p.id AS other_id, p.name AS other_name, p.title AS other_title,
            p.university AS other_university, p.department AS other_department,
            p.photo_url AS other_photo_url
     FROM matches m
     JOIN professors p
       ON p.id = CASE WHEN m.professor_a_id = $2 THEN m.professor_b_id ELSE m.professor_a_id END
     WHERE m.id = $1 AND (m.professor_a_id = $2 OR m.professor_b_id = $2)`,
    [matchId, professorId]
  );
  return result.rows[0] || null;
}

// GET /messages/:matchId — the full thread, oldest first. Marks the other
// person's messages as read as a side effect of opening the thread.
router.get("/:matchId", requireAuth, async (req, res) => {
  const { matchId } = req.params;
  try {
    const match = await loadMatchForUser(matchId, req.professorId);
    if (!match) {
      return res.status(404).json({ error: "Match not found." });
    }

    await pool.query(
      `UPDATE messages SET read_at = now()
       WHERE match_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [matchId, req.professorId]
    );

    const messages = await pool.query(
      `SELECT id, sender_id, body, created_at FROM messages
       WHERE match_id = $1 ORDER BY created_at ASC`,
      [matchId]
    );

    res.json({
      otherProfessor: {
        id: match.other_id,
        name: match.other_name,
        title: match.other_title,
        university: match.other_university,
        department: match.other_department,
        photo_url: match.other_photo_url,
      },
      messages: messages.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading this chat." });
  }
});

// POST /messages/:matchId — send a message. Body: { body }
router.post("/:matchId", requireAuth, async (req, res) => {
  const { matchId } = req.params;
  const { body } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ error: "Message can't be empty." });
  }

  try {
    const match = await loadMatchForUser(matchId, req.professorId);
    if (!match) {
      return res.status(404).json({ error: "Match not found." });
    }

    const result = await pool.query(
      `INSERT INTO messages (match_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, body, created_at`,
      [matchId, req.professorId, body.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong sending that message." });
  }
});

module.exports = router;
