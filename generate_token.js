const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_IGakLQ42iTNM@ep-restless-cake-ap9b4rmu-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  await client.connect();
  try {
    const userRes = await client.query('SELECT * FROM users LIMIT 1');
    const user = userRes.rows[0];
    if (!user) {
      console.log('No user');
      return;
    }
    console.log('User ID:', user.id);
    
    const bizRes = await client.query('SELECT * FROM business_users WHERE "userId" = $1 LIMIT 1', [user.id]);
    const biz = bizRes.rows[0];
    console.log('Business ID:', biz ? biz.businessId : 'none');
    
    const token = jwt.sign(
      { userId: user.id },
      'super_secret_key_123',
      { expiresIn: '7d', issuer: 'QUE-Accounting', audience: 'QUE-Accounting-Users' }
    );
    console.log('TOKEN:', token);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
