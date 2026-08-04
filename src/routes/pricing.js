// Public (professor-facing) read of current prices, so the app can show
// live numbers instead of hardcoded text. Admin-side editing lives in
// src/routes/admin.js.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT key, label, amount_paise, unit FROM pricing");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading pricing." });
  }
});

module.exports = router;
