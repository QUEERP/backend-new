const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_IGakLQ42iTNM@ep-solitary-wave-ap5le1me-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const loc = await pool.query(`
      SELECT name, code FROM warehouse_locations WHERE id = 'e014e157-5418-4aa2-883c-cba4b00d653c'
    `);
    console.log("Location:", loc.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
