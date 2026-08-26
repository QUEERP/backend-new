require('dotenv/config');
const prisma = require('./src/config/prisma');
const TaxExportController = require('./src/controllers/taxStatutoryExportController');
const fs = require('fs');
const pdfLib = require('pdf-parse');
const pdfParseFn = pdfLib.PDFParse ? pdfLib.PDFParse : pdfLib;

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
        params: {}
    };

    console.log("\nTesting Tax Transactions Export (PDF)...");
    req.params.format = 'pdf';
    
    const { PassThrough } = require('stream');
    const pdfStream = new PassThrough();
    const pdfFile = fs.createWriteStream('tax-txn-export.pdf');
    pdfStream.pipe(pdfFile);
    
    const resPdf = {
        setHeader: (name, val) => {},
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
    
    // Wait for the stream to finish before reading
    await new Promise((resolve) => {
      pdfFile.on('finish', resolve);
    });

    console.log("PDF generated. Reading text content to verify layout...");
    const PDFParser = require("pdf2json");
    const pdfParser = new PDFParser(this, 1);
    
    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
    pdfParser.on("pdfParser_dataReady", pdfData => {
        console.log("\n--- PDF CONTENT EXTRACTED ---");
        console.log(pdfParser.getRawTextContent().substring(0, 1500));
        
        console.log("\n\nTesting Statutory Report Export (JSON)...");
        req.params.format = 'json';
        req.params.reportCode = 'GSTR3B';
        
        const resStatutoryJson = {
            setHeader: (name, val) => {},
            send: (data) => {
                console.log("\n--- STATUTORY EXPORT OUTPUT (GSTR-3B JSON) ---");
                console.log(data.substring(0, 800));
            },
            status: (code) => {
                console.log(`Status: ${code}`);
                return resStatutoryJson;
            },
            json: (data) => console.log(JSON.stringify(data, null, 2))
        };
        
        TaxExportController.exportStatutoryReport(req, resStatutoryJson).then(() => {
            console.log("\n\nTesting Statutory Report Export (Excel)...");
            req.params.format = 'excel';
            const resStatutoryExcel = {
                setHeader: (name, val) => {},
                send: (data) => {
                    fs.writeFileSync('gstr3b-export.xlsx', data);
                    console.log("File saved to gstr3b-export.xlsx");
                    
                    // Verify Excel
                    const XLSX = require("xlsx");
                    const workbook = XLSX.readFile('gstr3b-export.xlsx');
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const parsedData = XLSX.utils.sheet_to_json(worksheet);
                    console.log("\n--- STATUTORY EXPORT OUTPUT (GSTR-3B EXCEL PARSED) ---");
                    console.log(JSON.stringify(parsedData, null, 2));
                    
                    console.log("\n\nTesting Statutory Report Export (PDF)...");
                    req.params.format = 'pdf';
                    
                    const { PassThrough } = require('stream');
                    const pdfStream2 = new PassThrough();
                    const pdfFile2 = fs.createWriteStream('gstr3b-export.pdf');
                    pdfStream2.pipe(pdfFile2);
                    
                    const resStatutoryPdf = {
                        setHeader: (name, val) => {},
                        on: pdfStream2.on.bind(pdfStream2),
                        once: pdfStream2.once.bind(pdfStream2),
                        emit: pdfStream2.emit.bind(pdfStream2),
                        write: pdfStream2.write.bind(pdfStream2),
                        end: pdfStream2.end.bind(pdfStream2),
                        removeListener: pdfStream2.removeListener.bind(pdfStream2),
                        status: (code) => {
                            console.log(`Status: ${code}`);
                            return resStatutoryPdf;
                        },
                        json: (data) => console.log(JSON.stringify(data, null, 2))
                    };
                    
                    TaxExportController.exportStatutoryReport(req, resStatutoryPdf).then(async () => {
                        // Wait for stream to finish
                        await new Promise((resolve) => {
                          pdfFile2.on('finish', resolve);
                        });
                        
                        const PDFParser2 = require("pdf2json");
                        const pdfParser2 = new PDFParser2(this, 1);
                        
                        pdfParser2.on("pdfParser_dataError", errData => console.error(errData.parserError) );
                        pdfParser2.on("pdfParser_dataReady", pdfData => {
                            console.log("\n--- STATUTORY EXPORT OUTPUT (GSTR-3B PDF TEXT) ---");
                            console.log(pdfParser2.getRawTextContent().substring(0, 1500));
                            prisma.$disconnect();
                        });
                        
                        pdfParser2.loadPDF("gstr3b-export.pdf");
                    });
                },
                status: (code) => {
                    return resStatutoryExcel;
                },
                json: (data) => console.log(JSON.stringify(data, null, 2))
            };
            
            TaxExportController.exportStatutoryReport(req, resStatutoryExcel);
        });
    });
    
    pdfParser.loadPDF("tax-txn-export.pdf");
    // Return early, the promise handles the async execution internally
    return;

  } catch(err) {
      console.error(err);
  } finally {
      await prisma.$disconnect();
  }
}

testExport();
