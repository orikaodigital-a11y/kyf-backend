// Discover (the swipe deck) and liking. This is where matching logic lives —
// a "match" is created automatically the moment two people have both liked each other.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { chargeWallet } = require("../lib/payments");

const router = express.Router();

const PRIORITY_CONNECT_PRICE_PAISE = 3000; // ₹30, mirrors the prototype's Priority Connect price

// Haversine distance in km, computed in SQL. Only ever returned when BOTH
// sides have location sharing on - never exposes anyone's raw lat/lng to
// another user, only an approximate distance (matches the prototype's
// privacy behavior).
const DISTANCE_KM_EXPR = `
  CASE
    WHEN $2::double precision IS NOT NULL AND $3::double precision IS NOT NULL
     AND p.location_enabled AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    THEN round((
      6371 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians($2::double precision)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians($3::double precision))
          + sin(radians($2::double precision)) * sin(radians(p.lat))
        ))
      )
    )::numeric, 1)
    ELSE NULL
  END AS distance_km
`;

async function getMyLocation(professorId) {
  const result = await pool.query(
    "SELECT location_enabled, lat, lng FROM professors WHERE id = $1",
    [professorId]
  );
  const me = result.rows[0];
  if (!me || !me.location_enabled || me.lat == null || me.lng == null) {
    return { lat: null, lng: null };
  }
  return { lat: me.lat, lng: me.lng };
}

// Records a like from -> to and creates a match if the other person already liked back.
// Shared by the free Like button and the paid Priority Connect action.
async function likeAndMaybeMatch(fromId, toId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO likes (from_professor_id, to_professor_id)
       VALUES ($1, $2)
       ON CONFLICT (from_professor_id, to_professor_id) DO NOTHING`,
      [fromId, toId]
    );
    const reverseLike = await client.query(
      "SELECT id FROM likes WHERE from_professor_id = $1 AND to_professor_id = $2",
      [toId, fromId]
    );
    let matched = false;
    if (reverseLike.rows.length > 0) {
      const [a, b] = [fromId, toId].sort();
      await client.query(
        `INSERT INTO matches (professor_a_id, professor_b_id)
         VALUES ($1, $2)
         ON CONFLICT (professor_a_id, professor_b_id) DO NOTHING`,
        [a, b]
      );
      matched = true;
    }
    await client.query("COMMIT");
    return matched;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// GET /discover — professors you haven't already liked or passed on, newest accounts first.
// This is a simple version; we'll add Collab Score ranking as its own pass later,
// once basic browsing works end to end.
router.get("/", requireAuth, async (req, res) => {
  try {
    const myLoc = await getMyLocation(req.professorId);
    const result = await pool.query(
      `SELECT p.id, p.name, p.title, p.university, p.department, p.category, p.tags, p.seeking, p.bio, p.photo_url, p.email_verified,
              ${DISTANCE_KM_EXPR}
       FROM professors p
       WHERE p.id != $1
         AND p.id NOT IN (
           SELECT to_professor_id FROM likes WHERE from_professor_id = $1
         )
         AND p.id NOT IN (
           SELECT passed_professor_id FROM passes WHERE professor_id = $1
         )
         AND p.id NOT IN (
           SELECT blocked_id FROM blocks WHERE blocker_id = $1
           UNION
           SELECT blocker_id FROM blocks WHERE blocked_id = $1
         )
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [req.professorId, myLoc.lat, myLoc.lng]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading professors." });
  }
});

// POST /discover/like/:professorId — like someone. If they already liked you,
// this creates a match automatically.
router.post("/like/:professorId", requireAuth, async (req, res) => {
  const fromId = req.professorId;
  const toId = req.params.professorId;

  if (fromId === toId) {
    return res.status(400).json({ error: "You can't like your own profile." });
  }

  try {
    const matched = await likeAndMaybeMatch(fromId, toId);
    res.json({ matched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong sending that like." });
  }
});

// POST /discover/priority/:professorId — paid Priority Connect: same as a like/match,
// but charges the wallet first so it's flagged as a priority request.
router.post("/priority/:professorId", requireAuth, async (req, res) => {
  const fromId = req.professorId;
  const toId = req.params.professorId;

  if (fromId === toId) {
    return res.status(400).json({ error: "You can't priority-connect with your own profile." });
  }

  try {
    let balance;
    try {
      const charge = await chargeWallet(
        fromId,
        PRIORITY_CONNECT_PRICE_PAISE,
        "priority_connect",
        `Priority Connect to professor ${toId}`
      );
      balance = charge.balance;
    } catch (err) {
      if (err.code === "INSUFFICIENT_FUNDS") {
        return res.status(402).json({ error: "Not enough wallet balance. Add money to your wallet first." });
      }
      throw err;
    }

    const matched = await likeAndMaybeMatch(fromId, toId);
    res.json({ matched, balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong sending that priority connect." });
  }
});

// POST /discover/pass/:professorId — pass on someone so they don't show up
// in your Discover deck again.
router.post("/pass/:professorId", requireAuth, async (req, res) => {
  const fromId = req.professorId;
  const toId = req.params.professorId;

  if (fromId === toId) {
    return res.status(400).json({ error: "You can't pass on your own profile." });
  }

  try {
    await pool.query(
      `INSERT INTO passes (professor_id, passed_professor_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [fromId, toId]
    );
    res.json({ passed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong recording that pass." });
  }
});
// GET /discover/interested — people who liked you but you haven't liked back yet
// (once you like them back, they move to Matches instead of showing here)
router.get("/interested", requireAuth, async (req, res) => {
  const myId = req.professorId;

  try {
    const myLoc = await getMyLocation(myId);
    const result = await pool.query(
      `SELECT p.id, p.name, p.title, p.university, p.department, p.category, p.tags, p.seeking, p.bio, p.photo_url, p.email_verified,
              ${DISTANCE_KM_EXPR}
       FROM professors p
       JOIN likes l ON l.from_professor_id = p.id
       WHERE l.to_professor_id = $1
         AND p.id NOT IN (
           SELECT to_professor_id FROM likes WHERE from_professor_id = $1
         )
       ORDER BY l.created_at DESC`,
      [myId, myLoc.lat, myLoc.lng]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading interested profiles." });
  }
});
module.exports = router;
