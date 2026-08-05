// Admin-only routes: Overview, Reported Profiles moderation, Support tickets,
// Sponsored Ads approval. All gated by requireAdminAuth (a separate token
// scope from professor logins - see src/middleware/auth.js).
const express = require("express");
const pool = require("../db");
const { requireAdminAuth } = require("../middleware/auth");
const { resolveHeldTransaction } = require("../lib/payments");
const { sendExpoPushNotifications } = require("../lib/expoPush");

const router = express.Router();

// ---------------- Overview ----------------
router.get("/overview", requireAdminAuth, async (req, res) => {
  try {
    const [revenueRes, professorCountRes, signupsRes, openTicketsRes, byFeatureRes] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM transactions WHERE status = 'completed'"),
      pool.query("SELECT COUNT(*) AS total FROM professors"),
      pool.query(
        `SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
         FROM professors
         WHERE created_at > now() - interval '7 days'
         GROUP BY day ORDER BY day ASC`
      ),
      pool.query("SELECT COUNT(*) AS total FROM support_tickets WHERE status = 'Submitted'"),
      pool.query(
        `SELECT type, COALESCE(SUM(amount_paise), 0) AS total
         FROM transactions WHERE status = 'completed'
         GROUP BY type ORDER BY total DESC`
      ),
    ]);

    res.json({
      revenuePaise: Number(revenueRes.rows[0].total),
      professorCount: Number(professorCountRes.rows[0].total),
      signupsLast7Days: signupsRes.rows.map((r) => ({ day: r.day, count: Number(r.count) })),
      openSupportTickets: Number(openTicketsRes.rows[0].total),
      revenueByFeature: byFeatureRes.rows.map((r) => ({ type: r.type, amountPaise: Number(r.total) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading the overview." });
  }
});

// ---------------- Reported Profiles ----------------
router.get("/reports", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.name AS reported_name, p.university AS reported_university, p.category AS reported_category,
              rp.name AS reporter_name
       FROM reports r
       JOIN professors p ON p.id = r.reported_id
       JOIN professors rp ON rp.id = r.reporter_id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading reports." });
  }
});

// PATCH /admin/reports/:id — Body: { status }. Valid: awaiting_documents, under_review, approved, rejected, removed, new
router.patch("/reports/:id", requireAdminAuth, async (req, res) => {
  const { status } = req.body;
  const VALID = ["new", "awaiting_documents", "under_review", "approved", "rejected", "removed"];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  try {
    const result = await pool.query(
      "UPDATE reports SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Report not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that report." });
  }
});

// ---------------- Verification requests ----------------
// Manual identity verification for professors without an institutional email.
router.get("/verification-requests", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, p.name AS professor_name, p.email AS professor_email, p.university AS professor_university
       FROM verification_requests vr
       JOIN professors p ON p.id = vr.professor_id
       ORDER BY (vr.status = 'pending') DESC, vr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading verification requests." });
  }
});

// PATCH /admin/verification-requests/:id — Body: { status, adminNote }. status: approved | rejected
router.patch("/verification-requests/:id", requireAdminAuth, async (req, res) => {
  const { status, adminNote } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  try {
    const result = await pool.query(
      `UPDATE verification_requests SET status = $1, admin_note = $2, reviewed_at = now()
       WHERE id = $3 RETURNING *`,
      [status, adminNote || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found." });
    }
    const request = result.rows[0];
    if (status === "approved") {
      await pool.query("UPDATE professors SET email_verified = true WHERE id = $1", [request.professor_id]);
    }
    res.json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that request." });
  }
});

// ---------------- Support tickets ----------------
router.get("/support-tickets", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, p.name AS professor_name, p.email AS professor_email
       FROM support_tickets t
       JOIN professors p ON p.id = t.professor_id
       ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading support tickets." });
  }
});

// PATCH /admin/support-tickets/:id — Body: { status }. Valid: Submitted, Resolved
router.patch("/support-tickets/:id", requireAdminAuth, async (req, res) => {
  const { status } = req.body;
  if (!["Submitted", "Resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  try {
    const result = await pool.query(
      "UPDATE support_tickets SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that ticket." });
  }
});

// ---------------- Sponsored Ads ----------------
router.get("/sponsored-ads", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sa.*, p.name AS requested_by_name
       FROM sponsored_ads sa
       LEFT JOIN professors p ON p.id = sa.requested_by_id
       ORDER BY sa.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading sponsored ads." });
  }
});

// PATCH /admin/sponsored-ads/:id/approve — captures the held payment, sets live.
router.patch("/sponsored-ads/:id/approve", requireAdminAuth, async (req, res) => {
  try {
    const adRes = await pool.query("SELECT * FROM sponsored_ads WHERE id = $1", [req.params.id]);
    const ad = adRes.rows[0];
    if (!ad) return res.status(404).json({ error: "Ad not found." });

    if (ad.transaction_id && ad.requested_by_id) {
      try {
        await resolveHeldTransaction(ad.transaction_id, ad.requested_by_id, "completed");
      } catch (err) {
        // Admin-created ads (no requester) have no held transaction - fine to continue.
      }
    }

    const result = await pool.query(
      `UPDATE sponsored_ads
       SET status = 'approved', active = true, started_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong approving that ad." });
  }
});

// PATCH /admin/sponsored-ads/:id/reject — releases the held payment.
router.patch("/sponsored-ads/:id/reject", requireAdminAuth, async (req, res) => {
  try {
    const adRes = await pool.query("SELECT * FROM sponsored_ads WHERE id = $1", [req.params.id]);
    const ad = adRes.rows[0];
    if (!ad) return res.status(404).json({ error: "Ad not found." });

    if (ad.transaction_id && ad.requested_by_id) {
      try {
        await resolveHeldTransaction(ad.transaction_id, ad.requested_by_id, "refunded");
      } catch (err) {
        // No held transaction to release - fine to continue.
      }
    }

    const result = await pool.query(
      "UPDATE sponsored_ads SET status = 'rejected', active = false WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong rejecting that ad." });
  }
});

// PATCH /admin/sponsored-ads/:id/close
router.patch("/sponsored-ads/:id/close", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE sponsored_ads SET status = 'closed', active = false WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Ad not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong closing that ad." });
  }
});

// POST /admin/sponsored-ads — admin-created ad, no payment/requester involved, goes live immediately.
router.post("/sponsored-ads", requireAdminAuth, async (req, res) => {
  const { advertiser, body, ctaLabel, link, categories } = req.body;
  if (!advertiser || !body || !link) {
    return res.status(400).json({ error: "Advertiser, body, and link are required." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO sponsored_ads (advertiser, body, cta_label, link, categories, status, active, started_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', true, now())
       RETURNING *`,
      [advertiser, body, ctaLabel || "Learn More", link, categories || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating that ad." });
  }
});

// ---------------- Pricing ----------------
router.get("/pricing", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pricing ORDER BY label ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading pricing." });
  }
});

// PATCH /admin/pricing/:key — Body: { amountPaise }
router.patch("/pricing/:key", requireAdminAuth, async (req, res) => {
  const amountPaise = Number(req.body.amountPaise);
  if (!amountPaise || amountPaise <= 0) {
    return res.status(400).json({ error: "Enter a valid amount." });
  }
  try {
    const result = await pool.query(
      "UPDATE pricing SET amount_paise = $1, updated_at = now() WHERE key = $2 RETURNING *",
      [amountPaise, req.params.key]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Unknown pricing key." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that price." });
  }
});

// ---------------- Promo Codes ----------------
router.get("/promo-codes", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM promo_codes ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading promo codes." });
  }
});

router.post("/promo-codes", requireAdminAuth, async (req, res) => {
  const { code, appliesTo, discountType, discountValue, maxUses } = req.body;
  if (!code || !appliesTo || !discountType) {
    return res.status(400).json({ error: "Code, applies-to, and discount type are required." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO promo_codes (code, applies_to, discount_type, discount_value, max_uses)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [code.toUpperCase(), appliesTo, discountType, discountValue || null, maxUses || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That code already exists." });
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating that code." });
  }
});

router.patch("/promo-codes/:code", requireAdminAuth, async (req, res) => {
  const { active } = req.body;
  try {
    const result = await pool.query(
      "UPDATE promo_codes SET active = $1 WHERE code = $2 RETURNING *",
      [!!active, req.params.code]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Code not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that code." });
  }
});

// ---------------- Bundle Offers ----------------
router.get("/bundle-offers", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM bundle_offers ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading bundle offers." });
  }
});

router.post("/bundle-offers", requireAdminAuth, async (req, res) => {
  const { feature, label, qty, unitPricePaise, pricePaise } = req.body;
  if (!feature || !label || !qty || !unitPricePaise || !pricePaise) {
    return res.status(400).json({ error: "All fields are required." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO bundle_offers (feature, label, qty, unit_price_paise, price_paise)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [feature, label, qty, unitPricePaise, pricePaise]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating that offer." });
  }
});

router.patch("/bundle-offers/:id", requireAdminAuth, async (req, res) => {
  const { active } = req.body;
  try {
    const result = await pool.query(
      "UPDATE bundle_offers SET active = $1 WHERE id = $2 RETURNING *",
      [!!active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Offer not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that offer." });
  }
});

// ---------------- Finance ----------------
router.get("/finance", requireAdminAuth, async (req, res) => {
  try {
    const [txnsRes, revenueRes, heldRes] = await Promise.all([
      pool.query(
        `SELECT t.*, p.name AS professor_name
         FROM transactions t
         JOIN professors p ON p.id = t.professor_id
         ORDER BY t.created_at DESC LIMIT 200`
      ),
      pool.query("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM transactions WHERE status = 'completed'"),
      pool.query("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM transactions WHERE status = 'held'"),
    ]);
    res.json({
      transactions: txnsRes.rows,
      revenuePaise: Number(revenueRes.rows[0].total),
      heldPaise: Number(heldRes.rows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading finance data." });
  }
});

// ---------------- Legal Pages ----------------
router.get("/legal-pages", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM legal_pages ORDER BY key ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading legal pages." });
  }
});

// PATCH /admin/legal-pages/:key — Body: { title?, body? }
router.patch("/legal-pages/:key", requireAdminAuth, async (req, res) => {
  const { title, body } = req.body;
  if (!title && !body) {
    return res.status(400).json({ error: "Nothing to update." });
  }
  try {
    const result = await pool.query(
      `UPDATE legal_pages SET title = COALESCE($1, title), body = COALESCE($2, body), updated_at = now()
       WHERE key = $3 RETURNING *`,
      [title || null, body || null, req.params.key]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Unknown legal page." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that page." });
  }
});

// ---------------- App Settings (help categories, announcement banner) ----------------
router.get("/app-settings", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM app_settings");
    const settings = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading app settings." });
  }
});

// PATCH /admin/app-settings/:key — Body: { value }
router.patch("/app-settings/:key", requireAdminAuth, async (req, res) => {
  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: "Value is required." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()
       RETURNING *`,
      [req.params.key, JSON.stringify(value)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating that setting." });
  }
});

// ---------------- Matching (Collab Score weights) ----------------
router.get("/matching/weights", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM collab_score_weights WHERE id = 1");
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading matching weights." });
  }
});

// PATCH /admin/matching/weights — Body: any subset of the weight columns
router.patch("/matching/weights", requireAdminAuth, async (req, res) => {
  const FIELDS = ["base", "category_match", "per_tag_overlap", "max_tag_bonus", "per_goal_overlap", "max_goal_bonus", "cap"];
  const updates = [];
  const values = [];
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) {
      const n = Number(req.body[field]);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: `Invalid value for ${field}.` });
      }
      values.push(n);
      updates.push(`${field} = $${values.length}`);
    }
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: "Nothing to update." });
  }
  values.push(1);
  try {
    const result = await pool.query(
      `UPDATE collab_score_weights SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating matching weights." });
  }
});

// ---------------- Push Notifications ----------------
router.get("/notifications", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sent_notifications ORDER BY created_at DESC LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading notification history." });
  }
});

// POST /admin/notifications/send — Body: { title, body }. Broadcasts to every
// professor who has registered a push token.
router.post("/notifications/send", requireAdminAuth, async (req, res) => {
  const { title, body } = req.body;
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "Title and body are required." });
  }
  try {
    const tokensRes = await pool.query("SELECT push_token FROM professors WHERE push_token IS NOT NULL");
    const tokens = tokensRes.rows.map((r) => r.push_token);
    const sent = await sendExpoPushNotifications(tokens, title.trim(), body.trim());

    const logRes = await pool.query(
      `INSERT INTO sent_notifications (title, body, target, recipient_count)
       VALUES ($1, $2, 'all', $3) RETURNING *`,
      [title.trim(), body.trim(), sent]
    );
    res.status(201).json(logRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong sending that notification." });
  }
});

module.exports = router;
