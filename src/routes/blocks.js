// Blocking another professor - stops them appearing in Discover and ends any
// existing match (which cascades to delete the chat thread).
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /blocks — Body: { professorId }
router.post("/", requireAuth, async (req, res) => {
  const { professorId } = req.body;
  if (!professorId) {
    return res.status(400).json({ error: "Missing professorId." });
  }
  if (professorId === req.professorId) {
    return res.status(400).json({ error: "You can't block your own profile." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [req.professorId, professorId]
    );
    const [a, b] = [req.professorId, professorId].sort();
    await client.query(
      "DELETE FROM matches WHERE professor_a_id = $1 AND professor_b_id = $2",
      [a, b]
    );
    await client.query("COMMIT");
    res.status(201).json({ blocked: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Something went wrong blocking that profile." });
  } finally {
    client.release();
  }
});

module.exports = router;
