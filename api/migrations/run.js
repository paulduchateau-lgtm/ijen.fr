require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '001_init.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✓ Migration 001_init applied');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
