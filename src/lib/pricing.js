// Reads live prices from the `pricing` table (admin-editable) instead of
// hardcoded constants, so a change in the admin dashboard takes effect on
// the next request with no deploy needed.
const pool = require("../db");

async function getPriceAmount(key) {
  const result = await pool.query("SELECT amount_paise FROM pricing WHERE key = $1", [key]);
  if (result.rows.length === 0) {
    throw new Error(`No pricing row found for "${key}" - run migrations/015_pricing.sql.`);
  }
  return Number(result.rows[0].amount_paise);
}

module.exports = { getPriceAmount };
