require('dotenv').config();
const http = require('http');
const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');

const API_HOST = 'localhost';
const API_PORT = process.env.PORT || 5002;

function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: API_HOST, port: API_PORT, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function registerAndLogin(tag) {
  const email = `test_${tag}_${Date.now()}@example.com`;
  const pwd   = 'TestPass@123';
  await apiCall('POST', '/api/auth/register', { name: tag, email, password: pwd });
  const lr = await apiCall('POST', '/api/auth/login', { email, password: pwd });
  return lr.body.token;
}

async function main() {
  console.log('\n======================================================================');
  console.log('1. SQL Query for CGST / SGST duplicate TaxType rows (India)');
  console.log('======================================================================');
  
  const inFw = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
  const inTypes = await prisma.taxType.findMany({
    where: { 
      taxFrameworkId: inFw.id, 
      name: { in: ['CGST', 'SGST'] }
    },
    select: { id: true, name: true, taxFrameworkId: true },
    orderBy: { name: 'asc' }
  });
  console.table(inTypes);

  const cgstCount = inTypes.filter(t => t.name === 'CGST').length;
  const sgstCount = inTypes.filter(t => t.name === 'SGST').length;
  console.log(`\nFound ${cgstCount} CGST TaxType rows and ${sgstCount} SGST TaxType rows for India GST framework.\n`);

  console.log('\n======================================================================');
  console.log('2. SQL Query for duplicate TaxRate rows mapped to VAT_STANDARD (UAE)');
  console.log('======================================================================');
  
  const uaeFw = await prisma.taxFramework.findFirst({ where: { name: 'UAE VAT' } });
  const uaeTypes = await prisma.taxType.findMany({
    where: { 
      taxFrameworkId: uaeFw.id,
      name: 'VAT_STANDARD'
    },
    select: { id: true, name: true, taxFrameworkId: true }
  });
  console.table(uaeTypes);
  console.log(`\nFound ${uaeTypes.length} VAT_STANDARD TaxType rows for UAE VAT framework.\n`);

  if (uaeTypes.length > 0) {
    const uaeRates = await prisma.taxRate.findMany({
      where: { taxTypeId: uaeTypes[0].id },
      select: { id: true, name: true, rate: true, taxTypeId: true, effectiveFrom: true },
      orderBy: { effectiveFrom: 'asc' }
    });
    console.log(`TaxRate rows linked to VAT_STANDARD TaxType (${uaeTypes[0].id}):`);
    console.table(uaeRates);
    console.log(`Found ${uaeRates.length} TaxRate rows under VAT_STANDARD.\n`);
  }
  
  console.log('\n======================================================================');
  console.log('3. India E2E Test: API Registration -> Create Business -> 18% TaxEngine');
  console.log('======================================================================');
  
  console.log('Registering test user and logging in...');
  const inToken = await registerAndLogin('india_user');
  
  const inBizName = `India Test Biz ${Date.now()}`;
  console.log(`Creating business (country: IN) via API: POST /api/business/create "${inBizName}"`);
  const inCreateRes = await apiCall('POST', '/api/business/create', { name: inBizName, country: 'IN', businessType: 'Trading' }, inToken);
  
  const inBizId = inCreateRes.body.data.id;
  console.log(`Business Created! ID: ${inBizId}\n`);
  
  console.log('Attempting TaxEngine calculation for INTRASTATE 18% (Maharashtra -> Maharashtra)...');
  try {
    const inTaxTxns = await TaxEngine.calculateTax({
      businessId: inBizId,
      businessState: 'Maharashtra',
      customerState:  'Maharashtra',
      lineSubtotal: 1000,
      taxPercent: 18,
      transactionDate: new Date('2026-01-01')
    });
    console.log('SUCCESS: ', inTaxTxns);
  } catch (err) {
    console.log(`ACTUAL ERROR THROWN:\n  ${err.stack.split('\\n')[0]}`);
  }

  console.log('\n======================================================================');
  console.log('4. UAE E2E Test: API Registration -> Create Business -> 5% TaxEngine');
  console.log('======================================================================');
  
  console.log('Registering test user and logging in...');
  const aeToken = await registerAndLogin('uae_user');
  
  const aeBizName = `UAE Test Biz ${Date.now()}`;
  console.log(`Creating business (country: AE) via API: POST /api/business/create "${aeBizName}"`);
  const aeCreateRes = await apiCall('POST', '/api/business/create', { name: aeBizName, country: 'AE', businessType: 'Trading' }, aeToken);
  
  const aeBizId = aeCreateRes.body.data.id;
  console.log(`Business Created! ID: ${aeBizId}\n`);
  
  console.log('Attempting TaxEngine calculation for VAT 5%...');
  try {
    const aeTaxTxns = await TaxEngine.calculateTax({
      businessId: aeBizId,
      lineSubtotal: 1000,
      taxPercent: 5,
      transactionDate: new Date('2026-01-01')
    });
    console.log('SUCCESS: ', aeTaxTxns);
  } catch (err) {
    console.log(`ACTUAL ERROR THROWN:\n  ${err.stack.split('\\n')[0]}`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("FATAL ERROR: ", err);
  process.exit(1);
});
