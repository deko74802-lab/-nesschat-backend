const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // нужно для Neon/Supabase/Render Postgres
});

module.exports = pool;
