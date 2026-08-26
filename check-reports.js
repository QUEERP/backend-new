require('dotenv/config');
const prisma = require('./src/config/prisma');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
const reportController = require('./src/controllers/reportController');

async function test() {
  const businessId = "954fc9b6-d5e8-4279-97d1-6936d37d7125";
  
  console.log('--- GSTR1 ---');
  const filters = { startDate: '2026-08-01', endDate: '2026-08-31' };
  try {
    const reportData = await statutoryRegistry.generateReport('India GST', 'GSTR1', businessId, filters);
    console.log(JSON.stringify(reportData, null, 2));
  } catch (err) {
    console.error(err);
  }

  console.log('--- Currency Gain/Loss ---');
  const req = {
    business: { id: businessId },
    query: {}
  };
  const res = {
    json: (data) => console.log('JSON:', JSON.stringify(data, null, 2)),
    status: (code) => {
      console.log('Status:', code);
      return { json: (data) => console.log('JSON:', JSON.stringify(data, null, 2)) };
    }
  };

  try {
    await reportController.getCurrencyGainLoss(req, res);
  } catch(err) {
    console.error(err);
  }
  
  await prisma.$disconnect();
}

test().catch(console.error);
