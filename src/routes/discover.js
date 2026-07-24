// Discover (the swipe deck) and liking. This is where matching logic lives —
// a "match" is created automatically the moment two people have both liked each other.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /discover — professors you haven't already liked or passed on, newest accounts first.
// This is a simple version; we'll add Collab Score ranking as its own pass later,
// once basic browsing works end to end.
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, title, university, department, category, tags, seeking, bio, photo_url
       FROM professors
       WHERE id != $1
         AND id NOT IN (
           SELECT to_professor_id FROM likes WHERE from_professor_id = $1
         )
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading professors." });
  }
});

// POST /discover/like/:professorId — like someone. If they already liked you,
// this creates a match automatically.
router.post("/like/:professorId", requireAuth, async (req, res) => {
  const fromId = req.professorId;
  const toId = req.params.professorId;

  if (fromId === toId) {
    return res.status(400).json({ error: "You can't like your own profile." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO likes (from_professor_id, to_professor_id)
       VALUES ($1, $2)
       ON CONFLICT (from_professor_id, to_professor_id) DO NOTHING`,
      [fromId, toId]
    );

    const reverseLike = await client.query(
      "SELECT id FROM likes WHERE from_professor_id = $1 AND to_professor_id = $2",
      [toId, fromId]
    );

    let matched = false;
    if (reverseLike.rows.length > 0) {
      // Store the pair in a consistent order so we never create the same match twice.
      const [a, b] = [fromId, toId].sort();
      await client.query(
        `INSERT INTO matches (professor_a_id, professor_b_id)
         VALUES ($1, $2)
         ON CONFLICT (professor_a_id, professor_b_id) DO NOTHING`,
        [a, b]
      );
      matched = true;
    }

    await client.query("COMMIT");
    res.json({ matched });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Something went wrong sending that like." });
  } finally {
    client.release();
  }
});

module.exports = router;
