const recurringService = require("../services/sales/recurring.service");
const { createRecurringInvoiceSchema } = require("../validations/sales.validation");
const { successResponse, errorResponse } = require("../utils/response");
const prisma = require("../config/prisma");

exports.createProfile = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user.userId || req.user.id;
    const userEmail = req.user.email;

    const validatedData = createRecurringInvoiceSchema.parse(req.body);

    const recurring = await recurringService.createRecurringInvoice(businessId, userId, userEmail, validatedData);

    return successResponse(res, recurring, "Recurring Invoice Profile created successfully", 201);
  } catch (error) {
    console.error("createProfile controller error:", error);
    if (error.name === "ZodError") {
      const msg = error.errors?.[0]?.message || error.issues?.[0]?.message || "Validation Error";
      return errorResponse(res, msg, 400, error.errors || error.issues);
    }
    return errorResponse(res, error.message, 400);
  }
};

exports.getProfiles = async (req, res) => {
  try {
    const businessId = req.business.id;

    const profiles = await prisma.recurringInvoice.findMany({
      where: { businessId },
      include: {
        customer: { select: { id: true, company: true } },
        items: true
      },
      orderBy: { createdAt: "desc" }
    });

    const mapped = profiles.map(p => ({
      ...p,
      nextBillingDate: p.nextBillingDate || p.nextInvoiceDate
    }));

    return successResponse(res, mapped, "Recurring profiles fetched successfully");
  } catch (error) {
    console.error("getProfiles controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

exports.triggerBillingJob = async (req, res) => {
  try {
    const logs = await recurringService.processRecurringInvoices();
    return successResponse(res, logs, "Recurring billing processing completed successfully");
  } catch (error) {
    console.error("triggerBillingJob controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const profile = await prisma.recurringInvoice.findFirst({
      where: { id, businessId },
      include: {
        customer: { select: { id: true, company: true } },
        items: true
      }
    });

    if (!profile) return errorResponse(res, "Recurring profile not found", 404);

    const mapped = {
      ...profile,
      nextBillingDate: profile.nextBillingDate || profile.nextInvoiceDate
    };

    return successResponse(res, mapped, "Recurring profile fetched successfully");
  } catch (error) {
    console.error("getProfile error:", error);
    return errorResponse(res, error.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;
    const data = req.body;

    const profile = await prisma.recurringInvoice.findFirst({
      where: { id, businessId },
      include: { items: true }
    });

    if (!profile) return errorResponse(res, "Recurring profile not found", 404);

    let subtotal = 0;
    let totalTax = 0;
    let grandTotal = 0;

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      for (const item of data.items) {
        const itemQty = Number(item.quantity !== undefined ? item.quantity : 1);
        const itemPrice = Number(item.price !== undefined ? item.price : (item.rate !== undefined ? item.rate : (item.amount || 0)));
        const itemSubtotal = itemQty * itemPrice;
        subtotal += itemSubtotal;

        let itemTax = 0;
        if (Array.isArray(item.taxDetails)) {
          for (const td of item.taxDetails) {
            itemTax += Number(td.amount !== undefined ? td.amount : (itemSubtotal * (Number(td.rate || 0) / 100)));
          }
        }
        totalTax += itemTax;
      }
      grandTotal = subtotal + totalTax;
    } else if (data.amount !== undefined || data.grandTotal !== undefined) {
      grandTotal = Number(data.amount !== undefined ? data.amount : data.grandTotal);
      subtotal = grandTotal;
    } else {
      grandTotal = Number(profile.grandTotal || 0);
      subtotal = Number(profile.subtotal || 0);
      totalTax = Number(profile.totalTax || 0);
    }

    const newStartDate = data.startDate ? new Date(data.startDate) : profile.startDate;
    const frequency = data.frequency || profile.frequency || "MONTHLY";
    let nextInvoiceDate = profile.nextInvoiceDate;
    if (data.startDate || !nextInvoiceDate) {
      nextInvoiceDate = new Date(newStartDate);
    }

    let updatedProfile;
    await prisma.$transaction(async (tx) => {
      const updateData = {
        profileName: data.profileName !== undefined ? data.profileName : profile.profileName,
        frequency: frequency,
        startDate: newStartDate,
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : profile.endDate,
        status: data.status || profile.status,
        subtotal,
        totalTax,
        grandTotal,
        nextInvoiceDate
      };

      await tx.recurringInvoice.update({
        where: { id },
        data: updateData,
      });
      
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        await tx.recurringInvoiceItem.deleteMany({ where: { recurringInvoiceId: id } });
        for (const item of data.items) {
          const itemQty = Number(item.quantity !== undefined ? item.quantity : 1);
          const itemPrice = Number(item.price !== undefined ? item.price : (item.rate !== undefined ? item.rate : 0));
          await tx.recurringInvoiceItem.create({
            data: {
              recurringInvoiceId: id,
              description: item.description || "",
              quantity: itemQty,
              price: itemPrice,
              total: item.total || (itemPrice * itemQty),
              taxDetails: item.taxDetails || []
            }
          });
        }
      }

      updatedProfile = await tx.recurringInvoice.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, company: true } },
          items: true
        }
      });
    });

    const mapped = {
      ...updatedProfile,
      nextBillingDate: updatedProfile?.nextBillingDate || updatedProfile?.nextInvoiceDate
    };

    return successResponse(res, mapped, "Recurring profile updated successfully");
  } catch (error) {
    console.error("updateProfile error:", error);
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const profile = await prisma.recurringInvoice.findFirst({
      where: { id, businessId }
    });

    if (!profile) return errorResponse(res, "Recurring profile not found", 404);

    await prisma.recurringInvoiceItem.deleteMany({
      where: { recurringInvoiceId: id }
    });

    await prisma.recurringInvoice.delete({
      where: { id }
    });

    return successResponse(res, null, "Recurring profile deleted successfully");
  } catch (error) {
    console.error("deleteProfile error:", error);
    return errorResponse(res, error.message, 500);
  }
};

exports.downloadProfilePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const profile = await prisma.recurringInvoice.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        business: true,
        items: true
      }
    });

    if (!profile) return errorResponse(res, "Recurring profile not found", 404);

    // Here we generate the PDF using the existing invoice template
    const generateInvoicePdf = require("../utils/generateInvoicePdf"); 
    
    // Format the profile data as if it were an invoice for the template
    const invoiceData = {
      ...profile,
      invoiceNumber: `RP-${profile.profileName || id.substring(0, 8)}`,
      invoiceDate: profile.startDate,
      dueDate: profile.endDate || profile.nextBillingDate,
      items: profile.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        price: item.rate,
        total: item.total,
        taxDetails: item.taxDetails
      }))
    };

    const pdfBuffer = await generateInvoicePdf(invoiceData, profile.business);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Recurring-Profile-${profile.id}.pdf`);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("downloadProfilePdf error:", error);
    return errorResponse(res, error.message, 500);
  }
};

