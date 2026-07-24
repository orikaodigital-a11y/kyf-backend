const express = require("express");
const pool = require("../db");

const router = express.Router();

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

    // 4. Block harmful content — words or bad URLs
    if (containsBannedContent(content) || containsBadUrl(content)) {
      return res.status(400).json({
        error: "This content violates our community guidelines and cannot be posted.",
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