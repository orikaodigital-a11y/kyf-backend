// Routes for professor profile data. We start with just "get my own profile" —
// this is the simplest possible route that proves login + tokens are working end-to-end.
const express = require("express");
const multer = require("multer");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { chargeWallet } = require("../lib/payments");
const { uploadFile } = require("../lib/storage");
const { getPriceAmount } = require("../lib/pricing");
const { ensureAutoVerified } = require("../lib/verification");
const { sendExpoPushNotifications } = require("../lib/expoPush");
const { createNotification } = require("../lib/notifications");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /professors/me  — requires a valid login token
router.get("/me", requireAuth, async (req, res) => {
  try {
    await ensureAutoVerified(req.professorId);
    const result = await pool.query(
      `SELECT id, name, university, department, category, email, username, email_verified,
              wallet_balance_paise, bio, tags, seeking, title, photo_url,
              orcid_id, orcid_verified, publications_count, h_index,
              featured_active, featured_expires_at, researchgate_url, scholar_url
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
// PUT /professors/me — update your own bio, tags, seeking, and research links.
router.put("/me", requireAuth, async (req, res) => {
  const { bio, tags, seeking, department, category, researchgateUrl, scholarUrl } = req.body;

  try {
    const result = await pool.query(
      `UPDATE professors
       SET bio = $1, tags = $2, seeking = $3, department = $4, category = $5,
           researchgate_url = COALESCE($6, researchgate_url), scholar_url = COALESCE($7, scholar_url)
       WHERE id = $8
       RETURNING id, name, university, department, category, username, email_verified, bio, tags, seeking, title, photo_url, researchgate_url, scholar_url`,
      [bio, tags, seeking, department, category, researchgateUrl || null, scholarUrl || null, req.professorId]
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

// PUT /professors/me/email — Body: { email }. Lets a professor switch to an
// institutional address later even if they signed up with a personal one -
// re-runs the auto-verify check right after, since that's the whole point.
router.put("/me/email", requireAuth, async (req, res) => {
  const email = (req.body.email || "").trim();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  try {
    const existing = await pool.query("SELECT id FROM professors WHERE email = $1 AND id != $2", [email, req.professorId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "That email is already in use by another account." });
    }
    await pool.query("UPDATE professors SET email = $1 WHERE id = $2", [email, req.professorId]);
    const verified = await ensureAutoVerified(req.professorId);
    res.json({ email, email_verified: verified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating your email." });
  }
});

// POST /professors/me/featured — activate Featured Profile for 30 days, paid.
router.post("/me/featured", requireAuth, async (req, res) => {
  try {
    try {
      const price = await getPriceAmount("featured_profile");
      await chargeWallet(req.professorId, price, "featured_profile", "Featured Profile - 30 days");
    } catch (err) {
      if (err.code === "INSUFFICIENT_FUNDS") {
        return res.status(402).json({ error: "Not enough wallet balance. Add money to your wallet first." });
      }
      throw err;
    }
    const result = await pool.query(
      `UPDATE professors
       SET featured_active = true, featured_expires_at = now() + interval '30 days'
       WHERE id = $1
       RETURNING featured_active, featured_expires_at`,
      [req.professorId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong activating Featured Profile." });
  }
});

// GET /professors/me/showcases
router.get("/me/showcases", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM feature_showcases WHERE professor_id = $1 ORDER BY created_at ASC",
      [req.professorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading your showcases." });
  }
});

// POST /professors/me/showcases — Body: { title, link }. Max 2, Featured Profile required.
router.post("/me/showcases", requireAuth, async (req, res) => {
  const { title, link } = req.body;
  if (!title) {
    return res.status(400).json({ error: "A title is required." });
  }
  try {
    const prof = await pool.query("SELECT featured_active FROM professors WHERE id = $1", [req.professorId]);
    if (!prof.rows[0]?.featured_active) {
      return res.status(403).json({ error: "Showcases require an active Featured Profile." });
    }
    const existing = await pool.query("SELECT id FROM feature_showcases WHERE professor_id = $1", [req.professorId]);
    if (existing.rows.length >= 2) {
      return res.status(400).json({ error: "You can only have 2 showcases at a time - remove one first." });
    }
    const result = await pool.query(
      "INSERT INTO feature_showcases (professor_id, title, link) VALUES ($1, $2, $3) RETURNING *",
      [req.professorId, title, link || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong adding that showcase." });
  }
});

// DELETE /professors/me/showcases/:id
router.delete("/me/showcases/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM feature_showcases WHERE id = $1 AND professor_id = $2 RETURNING id",
      [req.params.id, req.professorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Showcase not found." });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong removing that showcase." });
  }
});

// PUT /professors/me/location — Body: { enabled, lat, lng }
// lat/lng are optional when enabled=false (turning location off).
router.put("/me/location", requireAuth, async (req, res) => {
  const { enabled, lat, lng } = req.body;
  try {
    const result = await pool.query(
      `UPDATE professors SET location_enabled = $1, lat = $2, lng = $3
       WHERE id = $4
       RETURNING location_enabled, lat, lng`,
      [!!enabled, enabled ? lat : null, enabled ? lng : null, req.professorId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating your location." });
  }
});

// PATCH /professors/me/push-token — Body: { pushToken }. Saves this device's
// Expo push token so admin-sent notifications can reach it.
router.patch("/me/push-token", requireAuth, async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) {
    return res.status(400).json({ error: "Push token is required." });
  }
  try {
    const before = await pool.query("SELECT push_token FROM professors WHERE id = $1", [req.professorId]);
    const isFirstRegistration = !before.rows[0]?.push_token;
    await pool.query("UPDATE professors SET push_token = $1 WHERE id = $2", [pushToken, req.professorId]);
    res.json({ ok: true });

    // First time this professor's device registers a token - fire the
    // welcome notification if the admin has one configured. Best-effort,
    // never lets a failure here affect the (already-sent) response.
    if (isFirstRegistration) {
      try {
        const settingRes = await pool.query("SELECT value FROM app_settings WHERE key = 'welcome_notification'");
        const setting = settingRes.rows[0]?.value;
        if (setting?.active && setting.title?.trim() && setting.body?.trim()) {
          const body = setting.promoCode?.trim()
            ? `${setting.body.trim()} Use code ${setting.promoCode.trim()}.`
            : setting.body.trim();
          await sendExpoPushNotifications([pushToken], setting.title.trim(), body);
          await createNotification(req.professorId, "admin_broadcast", setting.title.trim(), body, null, null);
        }
      } catch (welcomeErr) {
        console.error(welcomeErr);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong saving your push token." });
  }
});

// POST /professors/me/photo — multipart form upload, field name "photo".
router.post("/me/photo", requireAuth, upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No photo was uploaded." });
  }
  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Only image files are allowed." });
  }

  try {
    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
    const path = `profile-photos/${req.professorId}-${Date.now()}.${ext}`;
    const photoUrl = await uploadFile(path, req.file.buffer, req.file.mimetype);

    const result = await pool.query(
      "UPDATE professors SET photo_url = $1 WHERE id = $2 RETURNING photo_url",
      [photoUrl, req.professorId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "STORAGE_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong uploading your photo." });
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
