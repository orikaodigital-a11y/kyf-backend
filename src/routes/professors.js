// Routes for professor profile data. We start with just "get my own profile" —
// this is the simplest possible route that proves login + tokens are working end-to-end.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /professors/me  — requires a valid login token
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, university, department, category, email, username, email_verified,
              wallet_balance_paise, bio, tags, seeking, title, photo_url,
              orcid_id, orcid_verified, publications_count, h_index
       FROM professors WHERE id = $1`,
      [req.professorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong fetching your profile." });
  }
});
// PUT /professors/me — update your own bio, tags, and seeking.
// Only these three fields can be changed here for now.
router.put("/me", requireAuth, async (req, res) => {
  const { bio, tags, seeking, department, category } = req.body;

  try {
    const result = await pool.query(
      `UPDATE professors
       SET bio = $1, tags = $2, seeking = $3, department = $4, category = $5
       WHERE id = $6
       RETURNING id, name, university, department, category, username, email_verified, bio, tags, seeking, title, photo_url`,
      [bio, tags, seeking, department, category, req.professorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating your profile." });
  }
});

function isValidOrcidFormat(id) {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id.trim());
}

// POST /professors/me/orcid-sync — Body: { orcidId }
// Calls ORCID's public API server-side (the browser can't - pub.orcid.org
// doesn't send CORS headers) and stores the verified works count.
router.post("/me/orcid-sync", requireAuth, async (req, res) => {
  const orcidId = (req.body.orcidId || "").trim();
  if (!isValidOrcidFormat(orcidId)) {
    return res.status(400).json({ error: "That doesn't look like a valid ORCID iD (format: 0000-0000-0000-0000)." });
  }

  try {
    const orcidRes = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/works`, {
      headers: { Accept: "application/json" },
    });
    if (!orcidRes.ok) {
      return res.status(404).json({ error: "Couldn't find that ORCID iD. Double-check it and try again." });
    }
    const data = await orcidRes.json();
    const works = Array.isArray(data.group) ? data.group.length : 0;

    const result = await pool.query(
      `UPDATE professors
       SET orcid_id = $1, orcid_verified = true, publications_count = $2
       WHERE id = $3
       RETURNING orcid_id, orcid_verified, publications_count, h_index`,
      [orcidId, works, req.professorId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong syncing with ORCID." });
  }
});

// GET /professors/search?q= — name, university, department, or tag match.
router.get("/search", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT id, name, title, university, department, category, tags, email_verified, photo_url
       FROM professors
       WHERE id != $2
         AND (
           name ILIKE $1
           OR university ILIKE $1
           OR department ILIKE $1
           OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ILIKE $1)
         )
       ORDER BY name ASC
       LIMIT 20`,
      [`%${q}%`, req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong searching." });
  }
});

// GET /professors/:id/status — public check, just verification status
// (Temporary: once real login sessions exist, use /me instead)
router.get("/:id/status", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT email_verified FROM professors WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json({ verified: result.rows[0].email_verified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});


// GET /professors/:id — public profile view (no email, no password)
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, university, department, category, username, email_verified, bio, tags, seeking, title, photo_url FROM professors WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});
module.exports = router;
