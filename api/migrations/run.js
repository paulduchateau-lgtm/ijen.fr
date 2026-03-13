require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const migrations = ['001_init.sql', '002_voyage_vectors.sql'];

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const file of migrations) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await pool.query(sql);
      console.log(`✓ ${file} applied`);
    }
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
