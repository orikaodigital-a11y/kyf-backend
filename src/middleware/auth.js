// This checks that a request has a valid login token before letting it through.
// Any route that needs "the logged-in professor" uses this.
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization; // expects "Bearer <token>"
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.professorId = payload.professorId; // now every route below knows who's asking
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired, please log in again." });
  }
}

// Same idea as requireAuth, but scoped to admin tokens only - an admin token
// never works on professor-facing routes and vice versa, since the JWT
// payload shape is different (adminId vs professorId) and each middleware
// only looks for its own field.
function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.adminId) {
      return res.status(401).json({ error: "Not an admin session." });
    }
    req.adminId = payload.adminId;
    req.adminRole = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired, please log in again." });
  }
}

module.exports = { requireAuth, requireAdminAuth };
