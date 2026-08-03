// Help & Support tickets.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /support/tickets — Body: { category, description }
router.post("/tickets", requireAuth, async (req, res) => {
  const { category, description } = req.body;
  if (!category || !description) {
    return res.status(400).json({ error: "Please choose a category and describe the issue." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO support_tickets (professor_id, category, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.professorId, category, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong submitting your issue." });
  }
});

// GET /support/tickets — the logged-in professor's own tickets, newest first.
router.get("/tickets", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM support_tickets WHERE professor_id = $1 ORDER BY created_at DESC",
      [req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading your tickets." });
  }
});

module.exports = router;
