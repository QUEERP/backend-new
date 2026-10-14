const invoiceService = require("../services/sales/invoice.service");
const { createInvoiceSchema, updateInvoiceSchema } = require("../validations/sales.validation");
const { successResponse, errorResponse } = require("../utils/response");
const prisma = require("../config/prisma");
const generateInvoicePdfHelper = require("../utils/generateInvoicePdf");
const uploadInvoicePdf = require("../utils/uploadInvoicePdf");
const generateInvoiceNumber = require("../utils/generateInvoiceNumber");
const InventoryService = require("../services/inventoryService");
const TaxEngine = require("../services/taxEngine");
const InvoiceWorkflow = require("../services/invoiceWorkflow");
const { roundHalfUp, getCurrencyDecimals } = require("../services/currencyFxService");

exports.createInvoice = async (req, res) => {
  console.log("=== CREATE INVOICE CALLED ===");
  try {
    const {
      customerId,
      salesOrderId,
      invoiceDate,
      dueDate,
      currency,
      poNumber,
      poDate,
      soNumber,
      soDate,
      adminNote,
      terms,
      discount = 0,
      shippingCharges = 0,
      items = [],
      designTemplate,
      // Tax fields
      cgst,
      sgst,
      igst,
      tds,
      ewayBillNo,
      reverseCharge = false,
      transportDetails,
      vatPercentage,
      vatAmount,
      vatType = "exclusive",
      emirate,
      projectId
    } = req.body;

    const settings = await prisma.settings.findUnique({
      where: { businessId: req.business.id },
    });
    
    const finalTemplate = designTemplate || settings?.invoiceTemplate || "modern";

    // 1. If salesOrderId is provided, use workflow for strict ERP consistency
    if (salesOrderId) {
      try {
        const invoiceNumber = await generateInvoiceNumber(req.business.id);
        const invoice = await InvoiceWorkflow.createInvoiceFromSalesOrder({
          businessId: req.business.id,
          salesOrderId,
          invoiceNumber,
          performedBy: req.user.userId,
          extraData: {
            cgst, sgst, igst, tds, ewayBillNo, reverseCharge, transportDetails,
            vatPercentage, vatAmount, vatType, emirate, shippingCharges,
            designTemplate: finalTemplate, projectId
          }
        });
        return res.status(201).json({ success: true, data: invoice });
      } catch (workflowErr) {
        return res.status(400).json({ success: false, message: workflowErr.message });
      }
    }

    // 2. Direct Invoice Logic
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: req.business.id },
    });

    if (!customer) {
      return res.status(400).json({ success: false, message: "Customer not found" });
    }

    // Verify Seller State for statutory Indian GST compliance
    const sellerCountry = (settings?.country || req.business.country || req.business.countryCode || 'IN').trim().toUpperCase();
    const sellerState = (settings?.state || req.business.state || '').trim();
    const isIndia = (sellerCountry === 'INDIA' || sellerCountry === 'IN' || req.business.countryCode === 'IN');

    if (isIndia && !sellerState) {
      return res.status(400).json({
        success: false,
        message: "Seller state is not configured in Business Settings. Place of supply cannot be determined for statutory GST compliance. Please update your business state in Settings before creating invoices."
      });
    }

    const customerCountry = (customer.country || customer.countryCode || 'IN').trim().toUpperCase();
    const customerState = (customer.state || customer.billingState || customer.shippingState || '').trim();
    const isCrossBorder = (sellerCountry !== customerCountry && !['IN','INDIA'].includes(sellerCountry) && !['IN','INDIA'].includes(customerCountry));
    const isInterState = isCrossBorder || (sellerState.toLowerCase() !== customerState.toLowerCase());

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(req.business.id);
      let serverSubtotal = 0;
      let serverTotalTax = 0;
      let serverCgst = 0;
      let serverSgst = 0;
      let serverIgst = 0;

      const invoiceItems = [];
      for (const item of items) {
        const qty = Number(item.quantity || item.hours || 0);
        const rate = Number(item.rate || item.price || 0);
        const lineAmount = qty * rate;
        serverSubtotal += lineAmount;

        const taxPct = Number(item.taxPercent ?? ((Number(item.cgstPercent || 0) + Number(item.sgstPercent || 0)) || Number(item.igstPercent || 0) || 0));

        let lineCgstPct = 0;
        let lineSgstPct = 0;
        let lineIgstPct = 0;
        let lineTax = 0;
        let lineCgst = 0;
        let lineSgst = 0;
        let lineIgst = 0;

        if (isIndia) {
          if (isInterState) {
            lineIgstPct = taxPct;
            lineIgst = Number(((lineAmount * lineIgstPct) / 100).toFixed(2));
            lineTax = lineIgst;
          } else {
            lineCgstPct = Number((taxPct / 2).toFixed(2));
            lineSgstPct = Number((taxPct / 2).toFixed(2));
            lineCgst = Number(((lineAmount * lineCgstPct) / 100).toFixed(2));
            lineSgst = Number(((lineAmount * lineSgstPct) / 100).toFixed(2));
            lineTax = lineCgst + lineSgst;
          }
        } else {
          lineTax = Number(((lineAmount * taxPct) / 100).toFixed(2));
        }

        serverTotalTax += lineTax;
        serverCgst += lineCgst;
        serverSgst += lineSgst;
        serverIgst += lineIgst;

        invoiceItems.push({
          productId: item.productId,
          warehouseId: item.warehouseId || null,
          itemName: item.itemName || item.name || item.description?.substring(0, 50),
          description: item.description,
          hsnSacCode: item.hsnSacCode || item.taxCode || null,
          itemType: item.itemType || 'GOODS',
          unit: item.unit || null,
          hours: Number(item.hours || item.quantity),
          quantity: qty,
          rate: rate,
          amount: lineAmount,
          taxPercent: taxPct,
          cgstPercent: lineCgstPct,
          sgstPercent: lineSgstPct,
          igstPercent: lineIgstPct,
          totalTax: lineTax,
          totalAmount: lineAmount + lineTax,
          discount: Number(item.discount || 0)
        });

        const resolvedItemType = item.itemType || item.type || 'GOODS';
        if (resolvedItemType === 'GOODS') {
          if (!item.warehouseId) {
            throw new Error(`Warehouse is required for goods item: ${item.name || item.description}`);
          }
          if (item.productId) {
            await InventoryService.decreaseStock({
              businessId: req.business.id,
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: qty,
              type: "SALE_OUT",
              reference: { referenceNo: invoiceNumber },
              performedBy: req.user.userId,
              tx
            });
          }
        }
      }

      // Data-quality check: header tax must equal the sum of line taxes
      const clientTotalTax = Number(req.body.totalTax ?? ((Number(cgst || 0) + Number(sgst || 0) + Number(igst || 0))));
      if (req.body.totalTax !== undefined && Math.abs(clientTotalTax - serverTotalTax) > 0.05) {
        console.warn(`[Tax Reconciled] Client header totalTax (₹${clientTotalTax}) differed from server line tax sum (₹${serverTotalTax}). Overriding header to computed line tax total.`);
      }

      const grandTotal = serverSubtotal + serverTotalTax + Number(shippingCharges) - Number(discount) - Number(tds || 0);

      return tx.invoice.create({
        data: {
          businessId: req.business.id,
          customerId,
          invoiceNumber,
          invoiceDate: new Date(invoiceDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          currency: currency || settings?.currency || "AED",
          poNumber,
          poDate: poDate ? new Date(poDate) : null,
          soNumber,
          soDate: soDate ? new Date(soDate) : null,
          adminNote: adminNote || settings?.defaultFooterNote || "Thank you",
          terms: terms || settings?.defaultTerms || "Payment due in 30 days",
          designTemplate: finalTemplate,
          subtotal: serverSubtotal,
          totalTax: serverTotalTax,
          discount,
          shippingCharges: Number(shippingCharges),
          grandTotal,
          cgst: serverCgst,
          sgst: serverSgst,
          igst: serverIgst,
          tds: Number(tds || 0),
          ewayBillNo,
          reverseCharge: !!reverseCharge,
          transportDetails,
          vatPercentage: Number(vatPercentage || 0),
          vatAmount: Number(vatAmount || 0),
          vatType,
          emirate,
          projectId: projectId || null,
          items: { create: invoiceItems },
        },
        include: {
          customer: true,
          items: { include: { warehouse: true } }
        },
      });
    }, {
      maxWait: 5000,
      timeout: 20000
    });

    if (projectId) {
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            revenue: { increment: invoice.grandTotal },
            invoicedRevenue: { increment: invoice.grandTotal }
          }
        });
      } catch (projErr) {
        console.error("Failed to update project revenue:", projErr);
      }
    }

    // PDF generation (async — non-blocking)
    setImmediate(async () => {
      try {
        const pdfBuffer = await generateInvoicePdfHelper(invoice, settings);
        const pdfUrl = await uploadInvoicePdf(pdfBuffer, invoice.invoiceNumber);
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { pdfUrl },
        });
        console.log("[Invoice PDF] Saved pdfUrl for", invoice.invoiceNumber);
      } catch (pdfErr) {
        console.error("[Invoice PDF] Generation/upload error:", pdfErr.message);
      }
    });

    return successResponse(res, invoice, "Invoice created successfully", 201);
  } catch (error) {
    console.error("createInvoice controller error:", error);
    if (error.name === "ZodError" && error.errors && error.errors.length) {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message || "Unexpected error", 400);
  }
};

//////////////////////////////////////////////////////
// CONVERT FROM SALES ORDER
//////////////////////////////////////////////////////
exports.createInvoiceFromSalesOrder = async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;

    const invoiceNumber = await generateInvoiceNumber(businessId);

    const invoice = await InvoiceWorkflow.createInvoiceFromSalesOrder({
      businessId,
      salesOrderId,
      invoiceNumber,
      performedBy: userId
    });

    res.status(201).json({
      success: true,
      message: "Invoice generated from Sales Order successfully.",
      data: invoice
    });
  } catch (error) {
    console.error("createInvoiceFromSalesOrder error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// CONVERT SALES ORDER (service-layer variant)
//////////////////////////////////////////////////////
exports.convertSalesOrder = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { salesOrderId } = req.params;

    let invoice = await invoiceService.convertSalesOrderToInvoice(businessId, userId, userEmail, salesOrderId);

    setImmediate(async () => {
      try {
        const settings = await prisma.settings.findUnique({ where: { businessId } });
        const pdfSettings = settings || { companyName: "Your Company", signatureUrl: null };
        const pdfBuffer = await generateInvoicePdfHelper(invoice, pdfSettings);
        const pdfUrl = await uploadInvoicePdf(pdfBuffer, invoice.invoiceNumber);
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { pdfUrl },
        });
        console.log("[Invoice PDF] Saved pdfUrl for", invoice.invoiceNumber);
      } catch (pdfError) {
        console.error("[Invoice PDF] Sales order conversion PDF error:", pdfError.message);
      }
    });

    return successResponse(res, invoice, "Sales Order billed to Invoice successfully", 201);
  } catch (error) {
    console.error("convertSalesOrder controller error:", error);
    return errorResponse(res, error.message, 400);
  }
};

//////////////////////////////////////////////////////
// GET ALL
//////////////////////////////////////////////////////
exports.getInvoices = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { customerId, status } = req.query;

    const data = await prisma.invoice.findMany({
      where: {
        businessId,
        isDeleted: false,
        customerId: customerId || undefined,
        status: status || undefined
      },
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 500
    });

    return successResponse(res, data, "Invoices fetched successfully");
  } catch (err) {
    console.error("getInvoices controller error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// GET ONE
//////////////////////////////////////////////////////
exports.getInvoiceById = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const invoice = await invoiceService.getInvoiceById(businessId, id);
    return successResponse(res, invoice, "Invoice retrieved successfully");
  } catch (err) {
    console.error("getInvoiceById controller error:", err);
    return errorResponse(res, err.message, 404);
  }
};

//////////////////////////////////////////////////////
// UPDATE
//////////////////////////////////////////////////////
exports.updateInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const {
      items = [],
      discount = 0,
      invoiceDate,
      dueDate,
      poNumber,
      poDate,
      soNumber,
      soDate,
      adminNote,
      terms,
      currency,
      designTemplate,
      shippingCharges = 0,
      status,
      cgst,
      sgst,
      igst,
      tds,
      ewayBillNo,
      reverseCharge,
      transportDetails,
      vatPercentage,
      vatAmount,
      vatType,
      emirate
    } = req.body;

    const invoiceObj = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoiceObj) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: invoiceObj.customerId, businessId: req.business.id },
    });

    const settings = await prisma.settings.findUnique({
      where: { businessId: req.business.id },
    });

    // Verify Seller State for statutory Indian GST compliance
    const sellerCountry = (settings?.country || req.business.country || req.business.countryCode || 'IN').trim().toUpperCase();
    const sellerState = (settings?.state || req.business.state || '').trim();
    const isIndia = (sellerCountry === 'INDIA' || sellerCountry === 'IN' || req.business.countryCode === 'IN');

    if (isIndia && !sellerState) {
      return res.status(400).json({
        success: false,
        message: "Seller state is not configured in Business Settings. Place of supply cannot be determined for statutory GST compliance."
      });
    }

    const customerCountry = (customer?.country || customer?.countryCode || 'IN').trim().toUpperCase();
    const customerState = (customer?.state || customer?.billingState || customer?.shippingState || '').trim();
    const isCrossBorder = (sellerCountry !== customerCountry && !['IN','INDIA'].includes(sellerCountry) && !['IN','INDIA'].includes(customerCountry));
    const isInterState = isCrossBorder || (sellerState.toLowerCase() !== customerState.toLowerCase());

    let serverSubtotal = 0;
    let serverTotalTax = 0;
    let serverCgst = 0;
    let serverSgst = 0;
    let serverIgst = 0;

    const newItems = items.map((i) => {
      const qty = Number(i.quantity || i.hours || 0);
      const rate = Number(i.rate || i.price || 0);
      const lineAmount = qty * rate;
      serverSubtotal += lineAmount;

      const taxPct = Number(i.taxPercent ?? ((Number(i.cgstPercent || 0) + Number(i.sgstPercent || 0)) || Number(i.igstPercent || 0) || 0));

      let lineCgstPct = 0;
      let lineSgstPct = 0;
      let lineIgstPct = 0;
      let lineTax = 0;
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (isIndia) {
        if (isInterState) {
          lineIgstPct = taxPct;
          lineIgst = Number(((lineAmount * lineIgstPct) / 100).toFixed(2));
          lineTax = lineIgst;
        } else {
          lineCgstPct = Number((taxPct / 2).toFixed(2));
          lineSgstPct = Number((taxPct / 2).toFixed(2));
          lineCgst = Number(((lineAmount * lineCgstPct) / 100).toFixed(2));
          lineSgst = Number(((lineAmount * lineSgstPct) / 100).toFixed(2));
          lineTax = lineCgst + lineSgst;
        }
      } else {
        lineTax = Number(((lineAmount * taxPct) / 100).toFixed(2));
      }

      serverTotalTax += lineTax;
      serverCgst += lineCgst;
      serverSgst += lineSgst;
      serverIgst += lineIgst;

      const isService = i.description && (
        i.description.toLowerCase().includes('service') ||
        i.description.toLowerCase().includes('consulting') ||
        i.description.toLowerCase().includes('development') ||
        i.itemType === 'SERVICE' || i.type === 'SERVICE'
      );

      return {
        invoiceId,
        productId: i.productId || null,
        warehouseId: i.warehouseId || null,
        itemName: i.itemName || i.name || i.description?.substring(0, 50),
        description: i.description,
        hsnSacCode: i.hsnSacCode || i.taxCode || null,
        itemType: isService ? 'SERVICE' : 'GOODS',
        unit: i.unit || null,
        hours: qty,
        quantity: qty,
        rate: rate,
        amount: lineAmount,
        taxPercent: taxPct,
        cgstPercent: lineCgstPct,
        sgstPercent: lineSgstPct,
        igstPercent: lineIgstPct,
        totalTax: lineTax,
        totalAmount: lineAmount + lineTax,
        discount: Number(i.discount || 0)
      };
    });

    const docCurrency = currency || invoiceObj.currency || 'INR';
    const decimals = getCurrencyDecimals(docCurrency);
    const grandTotal = roundHalfUp(serverSubtotal + serverTotalTax + Number(shippingCharges) - Number(discount) - Number(tds || 0), decimals);
    const exchangeRate = Number(invoiceObj.exchangeRate || 1);
    const baseCurrencyAmount = roundHalfUp(grandTotal * exchangeRate, decimals);

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });
      await tx.invoiceItem.createMany({ data: newItems });

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: serverSubtotal,
          totalTax: serverTotalTax,
          discount,
          grandTotal,
          exchangeRate,
          baseCurrencyAmount,
          statutoryExchangeRate: exchangeRate,
          statutoryBaseAmount: baseCurrencyAmount,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          poNumber,
          poDate: poDate ? new Date(poDate) : undefined,
          soNumber,
          soDate: soDate ? new Date(soDate) : undefined,
          adminNote,
          terms,
          currency,
          designTemplate,
          status,
          shippingCharges: Number(shippingCharges),
          cgst: serverCgst,
          sgst: serverSgst,
          igst: serverIgst,
          tds: tds !== undefined ? Number(tds) : undefined,
          ewayBillNo,
          reverseCharge: reverseCharge !== undefined ? !!reverseCharge : undefined,
          transportDetails,
          vatPercentage: vatPercentage !== undefined ? Number(vatPercentage) : undefined,
          vatAmount: vatAmount !== undefined ? Number(vatAmount) : undefined,
          vatType,
          emirate,
        },
        include: { customer: true, items: true },
      });
    });

    // Regenerate PDF (non-blocking)
    setImmediate(async () => {
      try {
        const settings = await prisma.settings.findUnique({
          where: { businessId: req.business.id },
        });
        const pdfSettings = settings || { companyName: "Your Company", signatureUrl: null };
        const pdfBuffer = await generateInvoicePdfHelper(updatedInvoice, pdfSettings);
        const pdfUrl = await uploadInvoicePdf(pdfBuffer, updatedInvoice.invoiceNumber);
        await prisma.invoice.update({
          where: { id: updatedInvoice.id },
          data: { pdfUrl }
        });
        console.log("[Invoice PDF] Updated pdfUrl for", updatedInvoice.invoiceNumber);
      } catch (pdfError) {
        console.error("[Invoice PDF] Regeneration failed on update:", pdfError.message);
      }
    });

    return successResponse(res, updatedInvoice, "Invoice updated successfully");
  } catch (error) {
    console.error("updateInvoice controller error:", error);
    if (error.name === "ZodError") {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message, 400);
  }
};

//////////////////////////////////////////////////////
// DELETE
//////////////////////////////////////////////////////
exports.deleteInvoice = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { id } = req.params;

    await invoiceService.deleteInvoice(businessId, userId, userEmail, id);
    return successResponse(res, null, "Invoice deleted and stock restored successfully");
  } catch (err) {
    console.error("deleteInvoice controller error:", err);
    return errorResponse(res, err.message, 400);
  }
};

//////////////////////////////////////////////////////
// PREVIEW INVOICE (HTML)
//////////////////////////////////////////////////////
exports.previewInvoice = async (req, res) => {
  try {
    const { designTemplate, customerId, items, ...rest } = req.body;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: req.business.id },
    });

    const business = await prisma.business.findUnique({
      where: { id: req.business.id },
    });

    let settings = await prisma.settings.findUnique({
      where: { businessId: req.business.id },
    });
    if (!settings) settings = {};
    if (business) settings.businessType = business.businessType;

    const mockInvoice = {
      ...rest,
      designTemplate: designTemplate || "modern",
      customer: customer || { company: "Customer Name", name: "Customer Name" },
      items: (items || []).map(it => ({
        ...it,
        totalAmount: Number(it.quantity || 0) * Number(it.rate || 0),
        taxDetails: []
      }))
    };

    const html = require("../templates/invoiceTemplate")(mockInvoice, settings || {});
    res.json({ success: true, html });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

//////////////////////////////////////////////////////
// GENERATE PDF (MANUAL)
//////////////////////////////////////////////////////
exports.generateInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId, isDeleted: false },
      include: { customer: true, items: true }
    });

    if (!invoice) {
      return errorResponse(res, "Invoice not found", 404);
    }

    const settings = await prisma.settings.findUnique({ where: { businessId } });
    const pdfSettings = settings || { companyName: "Your Company", signatureUrl: null };

    const pdfBuffer = await generateInvoicePdfHelper(invoice, pdfSettings);

    const pdfUrl = await uploadInvoicePdf(pdfBuffer, invoice.invoiceNumber);
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
      include: { customer: true, items: true }
    });

    return successResponse(res, { pdfUrl: updatedInvoice.pdfUrl }, "PDF generated successfully");
  } catch (err) {
    console.error("generateInvoicePdf controller error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// CHANGE STATUS
//////////////////////////////////////////////////////
exports.changeStatus = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return errorResponse(res, "Status is required", 400);
    }

    const invoice = await invoiceService.changeStatus(businessId, userId, userEmail, id, status);
    return successResponse(res, invoice, "Invoice status updated successfully");
  } catch (error) {
    console.error("changeStatus controller error:", error);
    return errorResponse(res, error.message, 400);
  }
};

//////////////////////////////////////////////////////
// DOWNLOAD PDF
//////////////////////////////////////////////////////
exports.downloadInvoicePdf = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({ where: { id, businessId } });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // Since Cloudinary blocks PDF delivery on free tier, generate it dynamically
    const generateInvoicePdfHelper = require("../utils/generateInvoicePdf");
    
    // We already found the invoice, but let's make sure we have items and customer
    const fullInvoice = await prisma.invoice.findFirst({
      where: { id: invoice.id },
      include: { customer: true, items: true }
    });

    const settings = await prisma.settings.findUnique({
      where: { businessId: req.business.id }
    });
    
    const pdfSettings = settings || { companyName: "Your Company", signatureUrl: null };
    const pdfBuffer = await generateInvoicePdfHelper(fullInvoice, pdfSettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNumber || id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.end(pdfBuffer);
  } catch (err) {
    console.error("downloadInvoicePdf controller error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};

//////////////////////////////////////////////////////
// BULK UPDATE INVOICES (Regenerate PDFs)
//////////////////////////////////////////////////////
exports.bulkUpdateInvoices = async (req, res) => {
  try {
    const businessId = req.business.id;

    const settings = await prisma.settings.findUnique({ where: { businessId } });
    const pdfSettings = settings || { companyName: "Your Company", signatureUrl: null };

    const invoices = await prisma.invoice.findMany({
      where: { businessId, isDeleted: false },
      include: { customer: true, items: true }
    });

    let updatedCount = 0;
    for (const inv of invoices) {
      try {
        const newTemplate = pdfSettings.invoiceTemplate || 'modern';
        inv.designTemplate = newTemplate;
        const pdfBuffer = await generateInvoicePdfHelper(inv, pdfSettings);
        const pdfUrl = await uploadInvoicePdf(pdfBuffer, inv.invoiceNumber);
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { pdfUrl, designTemplate: newTemplate }
        });
        updatedCount++;
      } catch (pdfErr) {
        console.error(`[Invoice PDF] Failed to sync PDF for invoice ${inv.invoiceNumber}:`, pdfErr.message);
      }
    }

    return successResponse(res, { updatedCount, totalCount: invoices.length }, "Invoices bulk updated successfully");
  } catch (err) {
    console.error("bulkUpdateInvoices controller error:", err);
    return errorResponse(res, err.message, 500);
  }
};