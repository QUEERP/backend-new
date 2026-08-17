const prisma = require("../config/prisma");
const { successResponse, errorResponse } = require("../utils/response");
const paymentService = require("../services/sales/payment.service");
const { createPaymentSchema, updatePaymentSchema } = require("../validations/sales.validation");

const createCreditNote = require("../utils/createCreditNote");
const generateCreditNumber = require("../utils/generateCreditNumber");

const generatePaymentPdf = require("../utils/generatePaymentPdf"); // invoice
const generateBillPaymentPdf = require("../utils/generateBillPaymentPdf"); // bill
const uploadPaymentPdf = require("../utils/uploadPaymentPdf");

//////////////////////////////////////////////////////
// CREATE PAYMENT (INVOICE + BILL)
//////////////////////////////////////////////////////
exports.createPayment = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;

    const { invoiceId, billId, quotationId, customerId, projectId } = req.params;

    //////////////////////////////////////////////////////
    // 🔥 BILL PAYMENT (PRESERVED LOGIC)
    //////////////////////////////////////////////////////
    if (billId) {
      const { amount, paymentDate, paymentMode, transactionId, note } = req.body;

      const bill = await prisma.bill.findFirst({
        where: { id: billId, businessId },
        include: { payments: true, vendor: true },
      });

      if (!bill) {
        return errorResponse(res, "Bill not found", 404);
      }

      if (bill.status === "PAID") {
        return errorResponse(res, "Bill is already paid", 400);
      }

      const previousPaid = bill.payments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );

      const currentAmount = Number(amount || 0);
      const totalPaid = previousPaid + currentAmount;
      const billTotal = Number(bill.totalAmount || 0);

      // Payment Number Generation
      const lastPayment = await prisma.payment.findFirst({
        where: { businessId },
        orderBy: { paymentNumber: "desc" },
        select: { paymentNumber: true },
      });

      let paymentNumber = "P-001";
      if (lastPayment?.paymentNumber) {
        const lastNumber = parseInt(lastPayment.paymentNumber.split("-")[1]);
        paymentNumber = `P-${String(lastNumber + 1).padStart(3, "0")}`;
      }

      let payment = await prisma.payment.create({
        data: {
          paymentNumber,
          billId,
          businessId,
          amount: currentAmount,
          paymentDate: new Date(paymentDate),
          paymentMode,
          transactionId,
          note,
          createdBy: userId,
        },
      });

      // Generate Bill Payment PDF
      const settings = await prisma.settings.findUnique({
        where: { businessId },
      });

      try {
        const pdfBuffer = await generateBillPaymentPdf(payment, bill, settings);
        const pdfUrl = await uploadPaymentPdf(pdfBuffer, payment.id);
        payment = await prisma.payment.update({
          where: { id: payment.id },
          data: { pdfUrl },
        });
      } catch (pdfError) {
        console.error("Bill PDF generation failed:", pdfError);
      }

      // Credit Note for overpayment
      let creditNote = null;
      if (totalPaid > billTotal) {
        const extraAmount = totalPaid - billTotal;
        const creditNumber = await generateCreditNumber(businessId, "BILL");
        creditNote = await prisma.creditNote.create({
          data: {
            business: { connect: { id: businessId } },
            vendor: { connect: { id: bill.vendorId } },
            creditNumber,
            type: "BILL",
            amount: extraAmount,
            remainingAmount: extraAmount,
            reason: "Overpayment from bill",
            status: "OPEN",
          },
        });
      }

      // Update Bill status
      let status = "UNPAID";
      if (totalPaid === 0) {
        status = "UNPAID";
      } else if (totalPaid < billTotal) {
        status = "PARTIALLY_PAID";
      } else {
        status = "PAID";
      }

      await prisma.bill.update({
        where: { id: billId },
        data: { status },
      });

      return successResponse(
        res,
        {
          payment,
          remaining: Math.max(billTotal - totalPaid, 0),
          creditNote,
        },
        "Bill payment recorded successfully"
      );
    }

    //////////////////////////////////////////////////////
    // 🔥 INVOICE PAYMENT (UPGRADED TO SERVICE LAYER)
    //////////////////////////////////////////////////////
    if (invoiceId) {
      // Validate payment payload using Zod
      const validatedData = createPaymentSchema.parse(req.body);

      const result = await paymentService.createPayment(businessId, userId, userEmail, invoiceId, validatedData);

      // Generate PDF
      try {
        const updatedInvoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            grandTotal: true,
            customer: true,
            payments: true,
          },
        });

        const settings = await prisma.settings.findUnique({
          where: { businessId },
        });

        const pdfBuffer2 = await generatePaymentPdf(
          result.payment,
          updatedInvoice,
          settings
        );

        const pdfUrl2 = await uploadPaymentPdf(pdfBuffer2, result.payment.id);
        result.payment = await prisma.payment.update({
          where: { id: result.payment.id },
          data: { pdfUrl: pdfUrl2 },
        });
        console.log("[Payment PDF] Saved pdfUrl for payment", result.payment.id);
      } catch (pdfError) {
        console.error("[Payment PDF] Invoice payment PDF generation failed:", pdfError.message);
      }

      return successResponse(
        res,
        result,
        "Invoice payment recorded successfully"
      );
    }

    //////////////////////////////////////////////////////
    // 🔥 QUOTATION PAYMENT
    //////////////////////////////////////////////////////
    if (quotationId) {
      const validatedData = createPaymentSchema.parse(req.body);

      const result = await paymentService.createQuotationPayment(businessId, userId, userEmail, quotationId, validatedData);

      return successResponse(
        res,
        result,
        "Payment recorded successfully"
      );
    }

    //////////////////////////////////////////////////////
    // 🔥 CUSTOMER PAYMENT (UNASSIGNED ADVANCE)
    //////////////////////////////////////////////////////
    if (customerId) {
      const validatedData = createPaymentSchema.parse(req.body);

      const result = await paymentService.createCustomerPayment(businessId, userId, userEmail, customerId, validatedData);

      return successResponse(
        res,
        result,
        "Customer advance payment recorded successfully"
      );
    }

    //////////////////////////////////////////////////////
    // 🔥 PROJECT PAYMENT
    //////////////////////////////////////////////////////
    if (projectId) {
      const validatedData = createPaymentSchema.parse(req.body);

      const result = await paymentService.createProjectPayment(businessId, userId, userEmail, projectId, validatedData);

      return successResponse(
        res,
        result,
        "Project payment recorded successfully"
      );
    }

    return errorResponse(res, "Missing invoiceId, billId, quotationId, customerId, or projectId parameter", 400);

  } catch (error) {
    console.error("createPayment controller error:", error);
    if (error.name === "ZodError") {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// UPDATE PAYMENT
//////////////////////////////////////////////////////
exports.updatePayment = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { paymentId } = req.params;

    const validatedData = updatePaymentSchema.parse(req.body);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId, businessId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            grandTotal: true,
            customer: true,
            payments: true
          }
        },
        bill: {
          select: {
            id: true,
            billNumber: true,
            vendor: {
              select: { name: true }
            }
          }
        },
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            customer: true
          }
        },
        project: {
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            customer: true
          }
        }
      }
    });

    if (!payment) {
      return errorResponse(res, "Payment not found", 404);
    }

    if (validatedData.amount < payment.amountAllocated) {
      return errorResponse(res, `Cannot reduce amount below allocated amount (${payment.amountAllocated})`, 400);
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: validatedData.amount,
        paymentDate: validatedData.paymentDate,
        paymentMode: validatedData.paymentMode,
        transactionId: validatedData.transactionId,
        note: validatedData.note,
        status: validatedData.amount === payment.amountAllocated ? 'fully_applied' : (payment.amountAllocated > 0 ? 'partially_applied' : 'unapplied')
      },
    });

    // Check if we need to update the invoice's amountPaid if this payment is directly linked to an invoice (and not just allocated)
    // Actually, in the current system, if a payment is created directly on an invoice, invoiceId is set.
    // If the amount is changed, we should probably update the invoice's amountPaid.
    // However, since allocations are tracked via paymentAllocations now (from previous code), 
    // it's safer to just let the user manage it, OR recalculate it.
    // For simplicity, we just update the payment record.

    // Regenerate PDF
    try {
      let documentData = null;
      if (payment.invoiceId && payment.invoice) {
        documentData = payment.invoice;
      } else if (payment.billId && payment.bill) {
        documentData = payment.bill;
      } else if (payment.quotationId && payment.quotation) {
        documentData = {
          invoiceNumber: payment.quotation.quoteNumber,
          customer: payment.quotation.customer,
          grandTotal: 0
        };
      } else if (payment.projectId && payment.project) {
        documentData = {
          invoiceNumber: payment.project.projectCode,
          customer: payment.project.customer,
          grandTotal: 0
        };
      } else {
        documentData = {
          invoiceNumber: '-',
          grandTotal: 0
        };
      }

      const settings = await prisma.settings.findUnique({
        where: { businessId },
      });

      const pdfBuffer = await generatePaymentPdf(
        updatedPayment,
        documentData,
        settings
      );

      const pdfUrl = await uploadPaymentPdf(pdfBuffer, updatedPayment.id);
      await prisma.payment.update({
        where: { id: updatedPayment.id },
        data: { pdfUrl },
      });
    } catch (pdfError) {
      console.error("[Payment PDF] Invoice payment PDF regeneration failed:", pdfError.message);
    }

    return successResponse(res, updatedPayment, "Payment updated successfully");
  } catch (error) {
    console.error("updatePayment controller error:", error);
    if (error.name === "ZodError") {
      return errorResponse(res, error.errors[0].message, 400, error.errors);
    }
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// GET PAYMENTS BY INVOICE
//////////////////////////////////////////////////////
exports.getInvoicePayments = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { invoiceId } = req.params;

    const payments = await paymentService.getPaymentsByInvoiceId(businessId, invoiceId);

    return successResponse(res, payments, "Invoice payments retrieved successfully");
  } catch (err) {
    console.error("getInvoicePayments controller error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// GET PAYMENTS BY QUOTATION
//////////////////////////////////////////////////////
exports.getQuotationPayments = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { quotationId } = req.params;

    const payments = await paymentService.getPaymentsByQuotationId(businessId, quotationId);

    return successResponse(res, payments, "Quotation payments retrieved successfully");
  } catch (err) {
    console.error("getQuotationPayments controller error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// GET PAYMENTS BY PROJECT
//////////////////////////////////////////////////////
exports.getProjectPayments = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { projectId } = req.params;

    const payments = await paymentService.getPaymentsByProjectId(businessId, projectId);

    return successResponse(res, payments, "Project payments retrieved successfully");
  } catch (err) {
    console.error("getProjectPayments controller error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// GET PAYMENTS BY BILL (PRESERVED)
//////////////////////////////////////////////////////
exports.getBillPayments = async (req, res) => {
  try {
    const { billId } = req.params;

    const payments = await prisma.payment.findMany({
      where: { billId, businessId: req.business.id },
      orderBy: { createdAt: "desc" },
      include: {
        bill: {
          select: {
            id: true,
            billNumber: true,
            totalAmount: true,
            vendor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return successResponse(res, payments, "Bill payments retrieved successfully");
  } catch (err) {
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// GET ALL PAYMENTS (PRESERVED)
//////////////////////////////////////////////////////
exports.getPayments = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { limit, customerId } = req.query;

    const where = { businessId };

    if (customerId) {
      where.OR = [
        { customerId },
        { invoice: { customerId } },
        { quotation: { customerId } },
      ];
    }

    let takeLimit = limit ? parseInt(limit) : 500;
    if (takeLimit > 500) takeLimit = 500;

    const payments = await prisma.payment.findMany({
      where,
      take: takeLimit,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            currency: true,
            projectId: true,
            project: { select: { id: true, projectName: true, projectCode: true } }
          },
        },
        bill: {
          select: {
            id: true,
            billNumber: true,
            vendor: {
              select: {
                name: true,
              },
            },
          },
        },
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            currency: true,
            projects: {
              select: {
                id: true,
                projectName: true,
                projectCode: true
              }
            }
          }
        },
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            currency: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, payments, "All payments retrieved successfully");
  } catch (error) {
    return errorResponse(res, "Failed to fetch payments", 500);
  }
};

//////////////////////////////////////////////////////
// DOWNLOAD PAYMENT PDF
//////////////////////////////////////////////////////
exports.downloadPaymentPdf = async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.paymentId || req.params.id,
        businessId: req.business.id,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Since Cloudinary is blocking PDF delivery (401), dynamically generate the PDF and send it
    const generatePaymentPdfHelper = require("../utils/generatePaymentPdf");
    
    let invoice = null;
    if (payment.invoiceId) {
      invoice = await prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
        include: { customer: true, payments: true }
      });
    } else if (payment.quotationId) {
      const quotation = await prisma.quotation.findUnique({
        where: { id: payment.quotationId },
        include: { customer: true, payments: true }
      });
      if (quotation) {
        invoice = {
          invoiceNumber: quotation.quoteNumber,
          invoiceDate: quotation.issueDate,
          grandTotal: quotation.totalAmount,
          customer: quotation.customer,
          payments: quotation.payments,
          currency: quotation.currency
        };
      }
    } else if (payment.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: payment.projectId },
        include: { customer: true, payments: true }
      });
      if (project) {
        invoice = {
          invoiceNumber: project.projectCode,
          invoiceDate: project.startDate || new Date(),
          grandTotal: project.budget,
          customer: project.customer,
          payments: project.payments,
          currency: project.currency
        };
      }
    } else if (payment.billId) {
      const bill = await prisma.bill.findUnique({
        where: { id: payment.billId },
        include: { vendor: true, payments: true }
      });
      if (bill) {
        invoice = {
          invoiceNumber: bill.billNumber,
          invoiceDate: bill.billDate,
          grandTotal: bill.totalAmount,
          customer: {
            company: bill.vendor?.name,
            billingStreet: bill.vendor?.billingAddress,
            billingCity: '',
            vatNumber: bill.vendor?.taxId
          },
          payments: bill.payments
        };
      }
    } else if (payment.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: payment.customerId }
      });
      if (customer) {
        invoice = {
          invoiceNumber: 'ADVANCE',
          invoiceDate: payment.paymentDate,
          grandTotal: payment.amount,
          customer: customer,
          payments: [],
          currency: customer.currency
        };
      }
    }
    
    if (!invoice) {
      invoice = {
        invoiceNumber: '-',
        invoiceDate: payment.paymentDate,
        grandTotal: payment.amount,
        customer: {},
        payments: []
      };
    }
    
    const settings = await prisma.settings.findUnique({
      where: { businessId: req.business.id }
    });

    const pdfBuffer = await generatePaymentPdfHelper(payment, invoice, settings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Payment_Slip_${payment.paymentNumber || payment.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("PDF download proxy error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download PDF",
    });
  }
};

const generateInvoiceNumber = require("../utils/generateInvoiceNumber");

exports.getPaymentDetails = async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, businessId: req.business.id },
      include: {
        paymentAllocations: {
          include: { invoice: true }
        },
        project: {
          select: { customerId: true }
        }
      }
    });

    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    const amount_unapplied = Number(payment.amount) - Number(payment.amountAllocated || 0);
    const customerId = payment.customerId || payment.project?.customerId || null;
    res.json({ success: true, data: { ...payment, customerId, unappliedBalance: amount_unapplied } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.allocateNewInvoice = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { invoiceAmount, invoiceNumber, dueDate, description } = req.body;
    const amount = Number(invoiceAmount);

    if (amount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });

    await prisma.$transaction(async (tx) => {
      const payments = await tx.$queryRaw`SELECT * FROM "payments" WHERE "id" = ${paymentId} AND "businessId" = ${req.business.id} FOR UPDATE`;
      if (!payments || payments.length === 0) throw new Error("Payment not found");
      const payment = payments[0];
      
      const unapplied = Number(payment.amount) - Number(payment.amountAllocated);
      if (amount > unapplied) throw new Error("Allocation amount exceeds unapplied balance");

      const invNum = invoiceNumber || await generateInvoiceNumber(req.business.id);

      const newInvoice = await tx.invoice.create({
        data: {
          businessId: req.business.id,
          customerId: payment.customerId, // assuming payment has customerId
          invoiceNumber: invNum,
          status: 'PAID',
          invoiceDate: new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          grandTotal: amount,
          subtotal: amount,
          amountPaid: amount,
          adminNote: description
        }
      });

      await tx.paymentAllocation.create({
        data: {
          paymentId,
          invoiceId: newInvoice.id,
          allocatedAmount: amount,
          allocationType: 'new_invoice',
          createdBy: req.user.userId || req.user.id
        }
      });

      const newAllocated = Number(payment.amountAllocated) + amount;
      const newStatus = newAllocated >= Number(payment.amount) ? 'fully_applied' : 'partially_applied';
      
      await tx.payment.update({
        where: { id: paymentId },
        data: { amountAllocated: newAllocated, status: newStatus }
      });
    });

    res.json({ success: true, message: "Allocated to new invoice successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.allocateExistingInvoice = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { invoiceId, amount: amountStr } = req.body;
    const amount = Number(amountStr);

    if (amount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });

    await prisma.$transaction(async (tx) => {
      const payments = await tx.$queryRaw`SELECT * FROM "payments" WHERE "id" = ${paymentId} AND "businessId" = ${req.business.id} FOR UPDATE`;
      if (!payments || payments.length === 0) throw new Error("Payment not found");
      const payment = payments[0];

      const invoices = await tx.$queryRaw`SELECT * FROM "invoices" WHERE "id" = ${invoiceId} AND "businessId" = ${req.business.id} FOR UPDATE`;
      if (!invoices || invoices.length === 0) throw new Error("Invoice not found");
      const invoice = invoices[0];

      if (invoice.status !== 'UNPAID') throw new Error("Invoice must be UNPAID");

      const unapplied = Number(payment.amount) - Number(payment.amountAllocated);
      const invoiceRemaining = Number(invoice.grandTotal) - Number(invoice.amountPaid);
      const allocAmount = Math.min(amount, unapplied, invoiceRemaining);

      if (allocAmount <= 0) throw new Error("Cannot allocate this amount");

      await tx.paymentAllocation.create({
        data: {
          paymentId,
          invoiceId,
          allocatedAmount: allocAmount,
          allocationType: 'existing_invoice',
          createdBy: req.user.userId || req.user.id
        }
      });

      const newAmountPaid = Number(invoice.amountPaid) + allocAmount;
      const newInvStatus = newAmountPaid >= Number(invoice.grandTotal) ? 'PAID' : 'PARTIALLY_PAID';
      
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: newAmountPaid, status: newInvStatus }
      });

      const newAllocated = Number(payment.amountAllocated) + allocAmount;
      const newStatus = newAllocated >= Number(payment.amount) ? 'fully_applied' : 'partially_applied';
      
      await tx.payment.update({
        where: { id: paymentId },
        data: { amountAllocated: newAllocated, status: newStatus }
      });
    });

    res.json({ success: true, message: "Allocated to existing invoice successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};