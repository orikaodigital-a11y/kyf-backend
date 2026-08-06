// Professor-facing read access to active bundle offers (admin manages them
// at /admin/bundle-offers). Surfaced as a banner on Discover.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /bundle-offers/active
router.get("/active", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, feature, label, qty, unit_price_paise, price_paise FROM bundle_offers WHERE active = true ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading offers." });
  }
});

module.exports = router;
