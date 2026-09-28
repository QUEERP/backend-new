const prisma = require('./src/config/prisma');
const reportService = require('./src/services/sales/report.service');

async function main() {
  const businessId = 'dc70ca38-b141-477d-a379-f02649117a78';
  const data = await reportService.getTradingSalesReport(businessId, null, 'quotations');
  console.log('Quotations Payload:', JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
