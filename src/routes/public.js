// Unauthenticated routes for the marketing website (knowyourfaculty.com) -
// no professor login involved, so these live separately from content.js
// (which requires requireAuth for the mobile app).
const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /public/android-download-url — the site's "Download for Android"
// button reads this so it never needs a code change when the APK/Play
// Store link changes - admin updates it from App Content -> app_settings.
router.get("/android-download-url", async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM app_settings WHERE key = 'android_download_url'");
    res.json({ url: result.rows[0]?.value || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// GET /public/android-waitlist/count
router.get("/android-waitlist/count", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) AS total FROM android_waitlist");
    res.json({ count: Number(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// POST /public/android-waitlist — Body: { email }
router.post("/android-waitlist", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  try {
    await pool.query(
      "INSERT INTO android_waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
      [email]
    );
    const result = await pool.query("SELECT COUNT(*) AS total FROM android_waitlist");
    res.status(201).json({ count: Number(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong joining the waitlist." });
  }
});

// GET /public/ios-waitlist/count
router.get("/ios-waitlist/count", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) AS total FROM ios_waitlist");
    res.json({ count: Number(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// POST /public/ios-waitlist — Body: { email }
router.post("/ios-waitlist", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  try {
    await pool.query(
      "INSERT INTO ios_waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
      [email]
    );
    const result = await pool.query("SELECT COUNT(*) AS total FROM ios_waitlist");
    res.status(201).json({ count: Number(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong joining the waitlist." });
  }
});

module.exports = router;
