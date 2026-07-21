// This file connects to your Supabase Postgres database.
// Every other file that needs the database imports "pool" from here.
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
});

module.exports = pool;
