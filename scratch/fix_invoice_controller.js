const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/invoiceController.js';
let content = fs.readFileSync(path, 'utf8');

const newCreateInvoice = `exports.createInvoice = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    
    const invoice = await invoiceService.createInvoice(businessId, userId, userEmail, req.body);

    setImmediate(async () => {
      try {
        const settings = await prisma.settings.findUnique({ where: { businessId } });
        const pdfSettings = settings || { companyName: "Your Company", signatureUrl: null };
        const pdfBuffer = await generateInvoicePdfHelper(invoice, pdfSettings);
        const pdfUrl = await uploadInvoicePdf(pdfBuffer, invoice.invoiceNumber);
        await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl } });
      } catch (e) {
        console.error("PDF generation failed in background", e);
      }
    });

    return res.status(201).json({ success: true, data: invoice, invoice });
  } catch (error) {
    console.error("createInvoice controller error:", error);
    if (error.name === "ZodError" && error.errors) {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message || "Unexpected error", 400);
  }
};`;

const newUpdateInvoice = `exports.updateInvoice = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const invoiceId = req.params.id;

    const invoice = await invoiceService.updateInvoice(businessId, userId, userEmail, invoiceId, req.body);

    setImmediate(async () => {
      try {
        const settings = await prisma.settings.findUnique({ where: { businessId } });
        const pdfSettings = settings || { companyName: "Your Company", signatureUrl: null };
        const pdfBuffer = await generateInvoicePdfHelper(invoice, pdfSettings);
        const pdfUrl = await uploadInvoicePdf(pdfBuffer, invoice.invoiceNumber);
        await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl } });
      } catch (e) {
        console.error("PDF generation failed in background", e);
      }
    });

    return successResponse(res, invoice, "Invoice updated successfully");
  } catch (error) {
    console.error("updateInvoice controller error:", error);
    if (error.name === "ZodError" && error.errors) {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message || "Unexpected error", 400);
  }
};`;

content = content.replace(/exports\.createInvoice = async \(req, res\) => \{[\s\S]*?(?=\n\n\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ CONVERT FROM SALES ORDER)/, newCreateInvoice);

content = content.replace(/exports\.updateInvoice = async \(req, res\) => \{[\s\S]*?(?=\n\n\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\n\/\/ DELETE INVOICE)/, newUpdateInvoice);

fs.writeFileSync(path, content, 'utf8');
console.log('Replaced createInvoice and updateInvoice');
