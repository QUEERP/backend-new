const fetch = require('node-fetch'); // we can just use native fetch in node 18+

async function run() {
  const token = process.argv[2] || '';
  const businessId = 'd2d876d6-0a29-4abc-971c-35c41276ddf7'; // Wait, let me query the business ID first from DB
}

run();
