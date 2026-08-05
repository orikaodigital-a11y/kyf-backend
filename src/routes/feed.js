const express = require("express");
const multer = require("multer");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { chargeWallet } = require("../lib/payments");
const { getPriceAmount } = require("../lib/pricing");
const { uploadFile } = require("../lib/storage");
const { ensureAutoVerified, requireVerified } = require("../lib/verification");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /feed/image — multipart upload, field name "image". Returns { imageUrl }
// so the app can attach it to a post created right after via POST /feed.
router.post("/image", requireAuth, requireVerified, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image was uploaded." });
  }
  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Only image files are allowed." });
  }
  try {
    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
    const path = `post-images/${req.professorId}-${Date.now()}.${ext}`;
    const imageUrl = await uploadFile(path, req.file.buffer, req.file.mimetype);
    res.json({ imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong uploading your image." });
  }
});

const BOOST_DURATION_DAYS = 3;

// Basic blocklist for harmful content — expand this list as needed
const bannedWords = [
  "porn", "sex video", "nude", "rape", "murder", "kill", "terrorist",
  "bomb", "drugs", "escort", "gambling"
];
// URL shorteners are blocked outright — they hide the real destination
const blockedShorteners = [
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly"
];

// Known harmful domain patterns — expand this list as needed
const blockedDomains = [
  "pornhub.com", "xvideos.com", "xnxx.com", "redtube.com",
  "bet365.com", "onlinecasino.com"
];
function containsContactInfo(text) {
  // Matches email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  // Matches Indian phone numbers: optional +91, optional spaces/dashes, 10 digits
  const phoneRegex = /(\+91[\-\s]?)?[6-9]\d{9}\b/;
  // Also catches numbers written with spaces/dashes like 98765 43210 or 98765-43210
  const spacedPhoneRegex = /\b[6-9]\d{2,4}[\-\s]\d{2,4}[\-\s]?\d{0,4}\b/;

  return emailRegex.test(text) || phoneRegex.test(text) || spacedPhoneRegex.test(text);
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

function containsBadUrl(text) {
  const urls = extractUrls(text);
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (blockedShorteners.some((d) => lower.includes(d))) return true;
    if (blockedDomains.some((d) => lower.includes(d))) return true;
  }
  return false;
}

function containsBannedContent(text) {
  const lower = text.toLowerCase();
  return bannedWords.some((word) => lower.includes(word));
}

// POST /feed
// Body: { content, linkUrl, categories (array), imageUrl }
// requireVerified already confirms the professor is verified before this runs.
router.post("/", requireAuth, requireVerified, async (req, res) => {
  const { content, linkUrl, categories, imageUrl } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // Block harmful content — words, bad URLs, or contact info
    const combinedText = linkUrl ? `${content} ${linkUrl}` : content;
    if (containsBannedContent(combinedText) || containsBadUrl(combinedText)) {
      return res.status(400).json({
        error: "This content violates our community guidelines and cannot be posted.",
      });
    }

    if (containsContactInfo(content)) {
      return res.status(400).json({
        error: "Sharing phone numbers or email addresses in the feed isn't allowed. Please connect through Matches instead.",
      });
    }

    const result = await pool.query(
      "INSERT INTO posts (professor_id, content, link_url, categories, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.professorId, content, linkUrl || null, categories || [], imageUrl || null]
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;
// GET /feed/:professor_id — fetch a professor's own posts
router.get("/:professor_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, content, created_at, boosted, boost_expires_at, link_url, categories, image_url FROM posts WHERE professor_id = $1 ORDER BY created_at DESC",
      [req.params.professor_id]
    );
    res.json({ posts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// GET /feed/all/posts — every professor's posts, boosted-and-unexpired first, then newest first.
router.get("/all/posts", requireAuth, requireVerified, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.id, po.content, po.created_at, po.boosted, po.boost_expires_at, po.link_url, po.categories, po.image_url,
              p.id AS author_id, p.name AS author_name, p.university AS author_university,
              p.department AS author_department, p.title AS author_title, p.email_verified AS author_verified
       FROM posts po
       JOIN professors p ON p.id = po.professor_id
       ORDER BY (po.boosted AND po.boost_expires_at > now()) DESC, po.created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading the feed." });
  }
});

// POST /feed/:id/boost — author-only, paid. Boosts the post to the top of everyone's feed for 3 days.
router.post("/:id/boost", requireAuth, async (req, res) => {
  try {
    const postResult = await pool.query("SELECT professor_id FROM posts WHERE id = $1", [req.params.id]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Post not found." });
    }
    if (postResult.rows[0].professor_id !== req.professorId) {
      return res.status(403).json({ error: "You can only boost your own posts." });
    }

    try {
      const price = await getPriceAmount("post_boost");
      await chargeWallet(req.professorId, price, "post_boost", `Boost for post ${req.params.id}`);
    } catch (err) {
      if (err.code === "INSUFFICIENT_FUNDS") {
        return res.status(402).json({ error: "Not enough wallet balance. Add money to your wallet first." });
      }
      throw err;
    }

    const result = await pool.query(
      `UPDATE posts SET boosted = true, boost_expires_at = now() + interval '${BOOST_DURATION_DAYS} days'
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong boosting that post." });
  }
});