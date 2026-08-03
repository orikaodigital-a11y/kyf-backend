// Applies a single migration file straight to the connected Supabase database.
// Usage: node scripts/run-migration.js migrations/004_messages.sql
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/db");

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/run-migration.js <path-to-sql-file>");
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
  console.log(`Applying ${file} ...`);
  await pool.query(sql);
  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
