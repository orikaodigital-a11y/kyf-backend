// Public (professor-facing) read of admin-editable content: legal pages,
// help categories, the announcement banner, and Collab Score weights.
// Admin-side editing lives in src/routes/admin.js.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const [legalRes, settingsRes, weightsRes] = await Promise.all([
      pool.query("SELECT key, title, body FROM legal_pages ORDER BY key ASC"),
      pool.query("SELECT key, value FROM app_settings"),
      pool.query("SELECT * FROM collab_score_weights WHERE id = 1"),
    ]);

    const settings = {};
    for (const row of settingsRes.rows) settings[row.key] = row.value;

    const w = weightsRes.rows[0];

    res.json({
      legalPages: legalRes.rows,
      helpCategories: settings.help_categories || [],
      announcementBanner: settings.announcement_banner || { active: false, text: "" },
      collabWeights: w
        ? {
            base: w.base,
            categoryMatch: w.category_match,
            perTagOverlap: w.per_tag_overlap,
            maxTagBonus: w.max_tag_bonus,
            perGoalOverlap: w.per_goal_overlap,
            maxGoalBonus: w.max_goal_bonus,
            cap: w.cap,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading app content." });
  }
});

module.exports = router;
