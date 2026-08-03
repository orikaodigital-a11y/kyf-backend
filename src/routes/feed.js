const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { chargeWallet } = require("../lib/payments");

const router = express.Router();

const POST_BOOST_PRICE_PAISE = 4900; // ₹49, mirrors the prototype's category boost price
const BOOST_DURATION_DAYS = 3;

// Domains treated as personal (NOT institutional) — block these from posting
const personalEmailDomains = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "icloud.com", "protonmail.com", "rediffmail.com", "live.com"
];

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

function isInstitutionalEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain && !personalEmailDomains.includes(domain);
}

// POST /feed
// Body: { professor_id, content }
router.post("/", async (req, res) => {
  const { professor_id, content } = req.body;

  if (!professor_id || !content) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // 1. Check professor exists and get their email + verified status
    const profResult = await pool.query(
      "SELECT email, email_verified FROM professors WHERE id = $1",
      [professor_id]
    );

    if (profResult.rows.length === 0) {
      return res.status(404).json({ error: "Professor not found." });
    }

    const professor = profResult.rows[0];

    // 2. Auto-verify if institutional email and not already verified
    if (!professor.email_verified && isInstitutionalEmail(professor.email)) {
      await pool.query(
        "UPDATE professors SET email_verified = true WHERE id = $1",
        [professor_id]
      );
      professor.email_verified = true;
    }

    // 3. Block posting if still not verified
    if (!professor.email_verified) {
      return res.status(403).json({
        error: "Please verify your institutional email to post in the feed.",
      });
    }

   // 4. Block harmful content — words, bad URLs, or contact info
    if (containsBannedContent(content) || containsBadUrl(content)) {
      return res.status(400).json({
        error: "This content violates our community guidelines and cannot be posted.",
      });
    }

    if (containsContactInfo(content)) {
      return res.status(400).json({
        error: "Sharing phone numbers or email addresses in the feed isn't allowed. Please connect through Matches instead.",
      });
    }

    // 5. Save the post
    const result = await pool.query(
      "INSERT INTO posts (professor_id, content) VALUES ($1, $2) RETURNING *",
      [professor_id, content]
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
      "SELECT id, content, created_at, boosted, boost_expires_at FROM posts WHERE professor_id = $1 ORDER BY created_at DESC",
      [req.params.professor_id]
    );
    res.json({ posts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// GET /feed/all/posts — every professor's posts, boosted-and-unexpired first, then newest first.
router.get("/all/posts", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.id, po.content, po.created_at, po.boosted, po.boost_expires_at,
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
      await chargeWallet(req.professorId, POST_BOOST_PRICE_PAISE, "post_boost", `Boost for post ${req.params.id}`);
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