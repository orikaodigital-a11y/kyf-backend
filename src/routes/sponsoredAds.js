// Self-serve Sponsored Ads. Submission holds funds from the wallet (status
// 'held', not yet counted as revenue); approving/rejecting the hold is an
// admin action that will land as its own route once the admin dashboard
// exists to drive it (see kyf_backend_architecture.md, section 5).
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { chargeWallet } = require("../lib/payments");

const router = express.Router();

const SPONSORED_AD_PRICE_PAISE = 100000; // ₹1000, mirrors the prototype's price

// POST /sponsored-ads — Body: { advertiser, body, ctaLabel, link, categories }
router.post("/", requireAuth, async (req, res) => {
  const { advertiser, body, ctaLabel, link, categories } = req.body;
  if (!advertiser || !body || !link) {
    return res.status(400).json({ error: "Advertiser, body, and link are required." });
  }

  try {
    let charge;
    try {
      charge = await chargeWallet(
        req.professorId,
        SPONSORED_AD_PRICE_PAISE,
        "sponsored_ad",
        `Sponsored ad — ${advertiser}`,
        "held"
      );
    } catch (err) {
      if (err.code === "INSUFFICIENT_FUNDS") {
        return res.status(402).json({ error: "Not enough wallet balance. Add money to your wallet first." });
      }
      throw err;
    }

    const result = await pool.query(
      `INSERT INTO sponsored_ads (requested_by_id, advertiser, body, cta_label, link, categories, transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.professorId, advertiser, body, ctaLabel || "Learn More", link, categories || [], charge.transaction.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong submitting that ad." });
  }
});

// GET /sponsored-ads — the logged-in professor's own submitted ads, newest first.
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM sponsored_ads WHERE requested_by_id = $1 ORDER BY created_at DESC",
      [req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading your sponsored ads." });
  }
});

module.exports = router;
