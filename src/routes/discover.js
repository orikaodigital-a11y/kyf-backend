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
      `SELECT id, name, title, university, department, category, tags, seeking, bio, photo_url, email_verified
       FROM professors
       WHERE id != $1
         AND id NOT IN (
           SELECT to_professor_id FROM likes WHERE from_professor_id = $1
         )
         AND id NOT IN (
           SELECT passed_professor_id FROM passes WHERE professor_id = $1
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

// POST /discover/pass/:professorId — pass on someone so they don't show up
// in your Discover deck again.
router.post("/pass/:professorId", requireAuth, async (req, res) => {
  const fromId = req.professorId;
  const toId = req.params.professorId;

  if (fromId === toId) {
    return res.status(400).json({ error: "You can't pass on your own profile." });
  }

  try {
    await pool.query(
      `INSERT INTO passes (professor_id, passed_professor_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [fromId, toId]
    );
    res.json({ passed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong recording that pass." });
  }
});
// GET /discover/interested — people who liked you but you haven't liked back yet
// (once you like them back, they move to Matches instead of showing here)
router.get("/interested", requireAuth, async (req, res) => {
  const myId = req.professorId;

  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.title, p.university, p.department, p.category, p.tags, p.seeking, p.bio, p.photo_url, p.email_verified
       FROM professors p
       JOIN likes l ON l.from_professor_id = p.id
       WHERE l.to_professor_id = $1
         AND p.id NOT IN (
           SELECT to_professor_id FROM likes WHERE from_professor_id = $1
         )
       ORDER BY l.created_at DESC`,
      [myId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading interested profiles." });
  }
});
module.exports = router;
