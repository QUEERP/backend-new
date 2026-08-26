require('dotenv/config');
const prisma = require('./src/config/prisma');
const TaxExportController = require('./src/controllers/taxStatutoryExportController');
const fs = require('fs');

async function testExport() {
  try {
    // Get a business that has tax transactions
    const txn = await prisma.taxTransaction.findFirst();
    
    if (!txn) {
        console.log("No tax transactions found in DB");
        return;
    }
    
    const business = await prisma.business.findUnique({
        where: { id: txn.businessId },
        include: { taxFramework: true }
    });
    
    if (!business) {
        console.log("Business for tax transaction not found");
        return;
    }
    
    console.log(`Using Business ID: ${business.id} for tests`);

    const req = {
        business: business,
        query: {},
        params: { format: 'json', reportCode: 'GSTR1' }
    };

    const res = {
        setHeader: (name, val) => console.log(`setHeader: ${name} = ${val}`),
        send: (data) => {
            console.log("\n--- EXPORT OUTPUT ---");
            console.log(data);
            fs.writeFileSync('tax-summary-export.json', data);
            console.log("File saved to tax-summary-export.json");
        },
        status: (code) => {
            console.log(`Status: ${code}`);
            return res;
        },
        json: (data) => console.log(JSON.stringify(data, null, 2))
    };

    console.log("Testing Tax Summary Export (JSON)...");
    await TaxExportController.exportTaxSummary(req, res);
    
    console.log("\nTesting Tax Transactions Export (Excel)...");
    req.params.format = 'excel';
    const resExcel = {
        setHeader: (name, val) => console.log(`setHeader: ${name} = ${val}`),
        send: (data) => {
            fs.writeFileSync('tax-txn-export.xlsx', data);
            console.log("File saved to tax-txn-export.xlsx");
        },
        status: (code) => {
            console.log(`Status: ${code}`);
            return resExcel;
        },
        json: (data) => console.log(JSON.stringify(data, null, 2))
    };
    await TaxExportController.exportTaxTransactions(req, resExcel);

    console.log("\nTesting Tax Transactions Export (PDF)...");
    req.params.format = 'pdf';
    
    // For PDF, pdfkit pipes to the response, so we need to mock a writable stream.
    const { PassThrough } = require('stream');
    const pdfStream = new PassThrough();
    const pdfFile = fs.createWriteStream('tax-txn-export.pdf');
    pdfStream.pipe(pdfFile);
    
    const resPdf = {
        setHeader: (name, val) => console.log(`setHeader: ${name} = ${val}`),
        on: pdfStream.on.bind(pdfStream),
        once: pdfStream.once.bind(pdfStream),
        emit: pdfStream.emit.bind(pdfStream),
        write: pdfStream.write.bind(pdfStream),
        end: pdfStream.end.bind(pdfStream),
        removeListener: pdfStream.removeListener.bind(pdfStream),
        status: (code) => {
            console.log(`Status: ${code}`);
            return resPdf;
        },
        json: (data) => console.log(JSON.stringify(data, null, 2))
    };
    
    await TaxExportController.exportTaxTransactions(req, resPdf);
    console.log("File saved to tax-txn-export.pdf (Stream started)");

  } catch(err) {
      console.error(err);
  } finally {
      await prisma.$disconnect();
  }
}

testExport();
