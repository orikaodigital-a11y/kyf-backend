// Admin login, plus a one-time bootstrap route to create the very first
// admin account (disables itself once any admin exists - no separate script
// or manual SQL insert needed to get started).
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

// POST /admin/auth/bootstrap — only works when the admins table is empty.
// Body: { name, email, password }
router.post("/bootstrap", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const existing = await pool.query("SELECT id FROM admins LIMIT 1");
    if (existing.rows.length > 0) {
      return res.status(403).json({ error: "An admin account already exists. Use /admin/auth/login instead." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'super_admin')
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );
    const admin = result.rows[0];
    const token = jwt.sign({ adminId: admin.id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ admin, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating the admin account." });
  }
});

// POST /admin/auth/login — Body: { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
    const admin = result.rows[0];
    if (!admin) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    const token = jwt.sign({ adminId: admin.id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
    delete admin.password_hash;
    res.json({ admin, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong logging you in." });
  }
});

module.exports = router;
