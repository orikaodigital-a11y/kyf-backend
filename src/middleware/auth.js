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

module.exports = { requireAuth };
