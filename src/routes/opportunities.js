// The Opportunities board — paid postings ("I'm looking for a co-author",
// "need a grant partner", etc.) that auto-expire after 30 days.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { chargeWallet } = require("../lib/payments");

const router = express.Router();

const OPPORTUNITY_POST_PRICE_PAISE = 10000; // ₹100, mirrors the prototype's pricing

// GET /opportunities — active (not yet expired) postings, newest first.
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.title, o.description, o.category, o.seeking, o.created_at, o.expires_at,
              p.id AS author_id, p.name AS author_name, p.university AS author_university,
              p.department AS author_department, p.title AS author_title
       FROM opportunities o
       JOIN professors p ON p.id = o.author_id
       WHERE o.expires_at > now()
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading opportunities." });
  }
});

// POST /opportunities — Body: { title, description, category, seeking }
// Charges the wallet, then posts, live for 30 days.
router.post("/", requireAuth, async (req, res) => {
  const { title, description, category, seeking } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ error: "Title, description, and category are required." });
  }

  try {
    try {
      await chargeWallet(req.professorId, OPPORTUNITY_POST_PRICE_PAISE, "opportunity_post", title);
    } catch (err) {
      if (err.code === "INSUFFICIENT_FUNDS") {
        return res.status(402).json({ error: "Not enough wallet balance. Add money to your wallet first." });
      }
      throw err;
    }

    const result = await pool.query(
      `INSERT INTO opportunities (author_id, title, description, category, seeking)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.professorId, title, description, category, seeking || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong posting that opportunity." });
  }
});

module.exports = router;
