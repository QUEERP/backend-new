const prisma = require('../src/config/prisma');
const gstTaxReportService = require('../src/services/gstTaxReportService');

async function testGst() {
  const businessId = 'dc70ca38-b141-477d-a379-f02649117a78';
  const report = await gstTaxReportService.generateGstTaxSummary({ businessId });
  console.log('=== GST REPORT KPIS ===');
  console.log(report.kpis);
  console.log('\n=== GST TAX LINES ===');
  console.log(report.taxLines);
  console.log('\n=== GST WARNINGS ===');
  console.log(report.dataQualityWarnings);
}

testGst().catch(console.error).finally(() => prisma.$disconnect());
