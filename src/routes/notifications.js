// In-app notification center - the bell dropdown in the top nav.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /notifications — most recent 50, newest first.
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notifications WHERE professor_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading notifications." });
  }
});

// GET /notifications/unread-count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) AS count FROM notifications WHERE professor_id = $1 AND read = false",
      [req.professorId]
    );
    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// PATCH /notifications/:id/read
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET read = true WHERE id = $1 AND professor_id = $2",
      [req.params.id, req.professorId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// PATCH /notifications/read-all
router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET read = true WHERE professor_id = $1 AND read = false",
      [req.professorId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;
