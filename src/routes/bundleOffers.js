// Professor-facing read access to active bundle offers (admin manages them
// at /admin/bundle-offers). Surfaced as a banner on Discover.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { purchaseBundle } = require("../lib/payments");

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

// POST /bundle-offers/:id/purchase — charges the wallet, adds credits for the feature.
router.post("/:id/purchase", requireAuth, async (req, res) => {
  try {
    const offerRes = await pool.query(
      "SELECT * FROM bundle_offers WHERE id = $1 AND active = true",
      [req.params.id]
    );
    const offer = offerRes.rows[0];
    if (!offer) return res.status(404).json({ error: "This offer is no longer available." });

    try {
      const result = await purchaseBundle(req.professorId, offer.feature, offer.qty, offer.price_paise, offer.label);
      res.status(201).json(result);
    } catch (err) {
      if (err.code === "INSUFFICIENT_FUNDS") {
        return res.status(402).json({ error: "Not enough wallet balance. Add money to your wallet first." });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong buying that bundle." });
  }
});

module.exports = router;
