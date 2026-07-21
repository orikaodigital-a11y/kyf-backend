// Signup and login. This is the very first real feature — nothing else works
// until a professor can create an account and log back in.
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

// POST /auth/signup
// Body: { name, university, department, category, email, username, password }
router.post("/signup", async (req, res) => {
  const { name, university, department, category, email, username, password } = req.body;

  if (!name || !university || !category || !email || !username || !password) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM professors WHERE email = $1 OR username = $2",
      [email, username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "That email or username is already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO professors (name, university, department, category, email, username, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, university, department, category, email, username`,
      [name, university, department || null, category, email, username, passwordHash]
    );

    const professor = result.rows[0];
    const token = jwt.sign({ professorId: professor.id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({ professor, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

// POST /auth/login
// Body: { username, password }
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    const result = await pool.query("SELECT * FROM professors WHERE username = $1", [username]);
    const professor = result.rows[0];

    if (!professor) {
      return res.status(401).json({ error: "Incorrect username or password." });
    }
    const valid = await bcrypt.compare(password, professor.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect username or password." });
    }

    const token = jwt.sign({ professorId: professor.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    delete professor.password_hash; // never send the hash back to the app

    res.json({ professor, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong logging you in." });
  }
});

module.exports = router;
