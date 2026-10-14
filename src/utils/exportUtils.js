const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const { htmlToPdfBuffer } = require("./launchBrowser");
const reportPdfTemplate = require("../templates/reportPdfTemplate");

const buildPDF = async (res, title, headers, colWidths, dataRows, businessName = "", options = {}) => {
  const safeFilename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

  try {
    const html = reportPdfTemplate({
      title,
      subtitle: options.subtitle || `${title} — Audit & Ledger Records`,
      business: options.business || { name: businessName },
      settings: options.settings || { companyName: businessName },
      period: options.period || "All Historic Records",
      kpis: options.kpis || [],
      headers,
      colWidths,
      dataRows,
      totals: options.totals || null,
      currencySymbol: options.currencySymbol || "₹",
      baseCurrency: options.baseCurrency || "INR"
    });

    const pdfBuffer = await htmlToPdfBuffer(html, { landscape: true, printBackground: true });
    return res.send(pdfBuffer);
  } catch (htmlPdfError) {
    console.warn("[buildPDF] HTML PDF generation warning, falling back to PDFKit:", htmlPdfError.message);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    if (businessName) {
      doc.fontSize(16).font('Helvetica-Bold').text(businessName, { align: 'center' });
    }
    doc.fontSize(14).font('Helvetica').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Oblique').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    
    if (dataRows.length === 0) {
      doc.fontSize(12).text("No data available.", { align: 'center' });
      doc.end();
      return;
    }

    const drawHeaders = (y) => {
      let currentX = 40;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      headers.forEach((h, i) => {
        doc.text(h, currentX, y, { width: colWidths[i] || 100, align: 'left' });
        currentX += (colWidths[i] || 100) + 10;
      });
      doc.moveTo(40, y + 14).lineTo(780, y + 14).lineWidth(1).strokeColor('#000000').stroke();
      return y + 25;
    };

    let currentY = drawHeaders(doc.y);
    doc.font('Helvetica').fontSize(9);
    
    dataRows.forEach(row => {
      if (currentY > 500) {
        doc.addPage();
        currentY = 40;
        currentY = drawHeaders(currentY);
        doc.font('Helvetica').fontSize(9);
      }
      
      let currentX = 40;
      row.forEach((text, i) => {
        doc.text(String(text ?? '-'), currentX, currentY, { width: colWidths[i] || 100, align: 'left' });
        currentX += (colWidths[i] || 100) + 10;
      });
      currentY += 20;
    });

    doc.end();
  }
};

const sendExcel = (res, filename, sheetName, data) => {
  if (data.length === 0) {
    data = [{ Message: "No data available" }];
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.xlsx"`);
  res.send(buffer);
};

const sendJSON = (res, filename, data) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.json"`);
  res.send(JSON.stringify(data, null, 2));
};

const sendCSV = (res, filename, data) => {
  if (!data || data.length === 0) {
    data = [{ Message: "No data available" }];
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
};

module.exports = {
  buildPDF,
  sendExcel,
  sendJSON,
  sendCSV
};
