const http = require('http');
const fs = require('fs');
const prisma = require('./src/config/prisma');

async function run() {
  const business = await prisma.business.findFirst({
    where: { baseCurrency: { code: 'CAD' } },
    orderBy: { createdAt: 'desc' }
  });

  if (!business) {
    console.error("No CAD test business found.");
    return;
  }

  const businessId = business.id;
  
  // Create an active mock token (just dummy for testing, but wait we need a real token)
  // Let's directly call the controller function by faking req/res
  const { exportCurrencyTransactions } = require('./src/controllers/currencyExportController');

  console.log("Testing JSON Export...");
  let jsonOutput = null;
  const jsonRes = {
    setHeader: () => {},
    send: (data) => {
      jsonOutput = JSON.parse(data);
    },
    status: (s) => ({ json: (d) => console.log('Error', s, d) })
  };
  await exportCurrencyTransactions({ business: { id: businessId }, query: {}, params: { format: 'json' } }, jsonRes);
  console.log(JSON.stringify(jsonOutput, null, 2));

  console.log("\nTesting Excel Export...");
  const excelRes = {
    setHeader: () => {},
    send: (data) => {
      fs.writeFileSync('currency-export.xlsx', data);
      console.log("Saved to currency-export.xlsx");
    },
    status: (s) => ({ json: (d) => console.log('Error', s, d) })
  };
  await exportCurrencyTransactions({ business: { id: businessId }, query: {}, params: { format: 'excel' } }, excelRes);

  console.log("\nTesting PDF Export...");
  const pdfRes = {
    setHeader: () => {},
    write: (chunk) => fs.appendFileSync('currency-export.pdf', chunk),
    end: () => console.log("Saved to currency-export.pdf"),
    on: (evt, cb) => { if (evt === 'data') pdfRes.write = cb; if (evt === 'end') pdfRes.end = cb; },
    once: () => {},
    emit: () => {},
    status: (s) => ({ json: (d) => console.log('Error', s, d) })
  };
  
  if (fs.existsSync('currency-export.pdf')) fs.unlinkSync('currency-export.pdf');
  await exportCurrencyTransactions({ business: { id: businessId }, query: {}, params: { format: 'pdf' } }, pdfRes);
}

run().catch(console.error).finally(() => prisma.$disconnect());
