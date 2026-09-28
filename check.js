const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function run() {
  await client.connect();
  const res = await client.query('SELECT "vendorType" FROM "Vendor" WHERE id=$1', ['6c691feb-b2e9-49c1-be13-8893b2605594']);
  console.log('RESULT:', res.rows);
  await client.end();
}
run();
