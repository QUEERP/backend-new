const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_IGakLQ42iTNM@ep-restless-cake-ap9b4rmu-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  await client.connect();
  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables:', res.rows.map(r => r.table_name));
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
