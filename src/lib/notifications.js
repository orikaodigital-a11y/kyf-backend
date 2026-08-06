// In-app notification center (the bell dropdown) - separate from OS push
// notifications, though the two often fire together for the same event.
const pool = require("../db");

async function createNotification(professorId, type, title, body, linkScreen, linkParams) {
  await pool.query(
    `INSERT INTO notifications (professor_id, type, title, body, link_screen, link_params)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [professorId, type, title, body, linkScreen || null, linkParams ? JSON.stringify(linkParams) : null]
  );
}

module.exports = { createNotification };
