// Admin-only routes: Overview, Reported Profiles moderation, Support tickets,
// Sponsored Ads approval. All gated by requireAdminAuth (a separate token
// scope from professor logins - see src/middleware/auth.js).
const express = require("express");
const pool = require("../db");
const { requireAdminAuth } = require("../middleware/auth");
const { resolveHeldTransaction } = require("../lib/payments");

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

module.exports = router;
