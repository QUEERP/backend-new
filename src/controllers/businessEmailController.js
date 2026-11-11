const prisma = require("../config/prisma");
const { encrypt, maskPassword } = require("../utils/cryptoUtils");
const {
  getBusinessEmailConfig,
  testBusinessEmail,
  sendBusinessEmail,
} = require("../utils/businessMailer");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Format a database record safely for client consumption
 * (Never leak encrypted or raw credentials)
 */
function formatSafeConfig(record) {
  if (!record) return null;
  return {
    id: record.id,
    businessId: record.businessId,
    email: record.email,
    senderName: record.senderName,
    smtpHost: record.smtpHost,
    smtpPort: record.smtpPort,
    smtpUser: record.smtpUser,
    encryption: record.encryption,
    isEnabled: record.isEnabled,
    isVerified: record.isVerified,
    lastTestedAt: record.lastTestedAt,
    lastTestStatus: record.lastTestStatus,
    lastTestError: record.lastTestError,
    hasPassword: Boolean(record.smtpPassEncrypted),
    maskedPassword: maskPassword(record.smtpPassEncrypted),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

//////////////////////////////////////////////////////
// GET BUSINESS EMAIL CONFIG
//////////////////////////////////////////////////////
exports.getConfig = async (req, res) => {
  try {
    const businessId = req.business.id;
    const config = await getBusinessEmailConfig(businessId);

    if (!config) {
      return successResponse(res, {
        isConfigured: false,
        config: null,
      }, "No business email configured yet");
    }

    return successResponse(res, {
      isConfigured: true,
      config: formatSafeConfig(config),
    }, "Business email configuration fetched successfully");
  } catch (err) {
    console.error("[BusinessEmail] getConfig error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// SAVE / UPDATE BUSINESS EMAIL CONFIG
//////////////////////////////////////////////////////
exports.saveConfig = async (req, res) => {
  try {
    const businessId = req.business.id;
    const {
      email,
      senderName,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      encryption,
      isEnabled,
    } = req.body;

    // Basic validation
    if (!email || !smtpHost || !smtpUser) {
      return errorResponse(res, "Business Email, SMTP Host, and SMTP Username are required.", 400);
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, "Please provide a valid business email address.", 400);
    }

    const existing = await getBusinessEmailConfig(businessId);

    let encryptedPass = existing?.smtpPassEncrypted || null;
    if (smtpPass && smtpPass.trim().length > 0) {
      encryptedPass = encrypt(smtpPass.trim());
    }

    if (!encryptedPass) {
      return errorResponse(res, "SMTP Password or App Password is required.", 400);
    }

    const port = Number(smtpPort) || 587;
    const encType = (encryption || "TLS").toUpperCase();
    const activeState = isEnabled !== undefined ? Boolean(isEnabled) : (existing ? existing.isEnabled : true);

    const updated = await prisma.businessEmailConfig.upsert({
      where: { businessId },
      update: {
        email: email.trim(),
        senderName: (senderName && senderName.trim()) || req.business.name || "Business Administrator",
        smtpHost: smtpHost.trim(),
        smtpPort: port,
        smtpUser: smtpUser.trim(),
        smtpPassEncrypted: encryptedPass,
        encryption: encType,
        isEnabled: activeState,
        updatedAt: new Date(),
      },
      create: {
        businessId,
        email: email.trim(),
        senderName: (senderName && senderName.trim()) || req.business.name || "Business Administrator",
        smtpHost: smtpHost.trim(),
        smtpPort: port,
        smtpUser: smtpUser.trim(),
        smtpPassEncrypted: encryptedPass,
        encryption: encType,
        isEnabled: activeState,
      },
    });

    return successResponse(res, formatSafeConfig(updated), "Business email configuration saved successfully");
  } catch (err) {
    console.error("[BusinessEmail] saveConfig error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// TEST BUSINESS EMAIL CONFIG
//////////////////////////////////////////////////////
exports.testConfig = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { recipientEmail } = req.body;

    if (!recipientEmail) {
      return errorResponse(res, "Recipient email address is required to perform test email.", 400);
    }

    const result = await testBusinessEmail(businessId, req.body);
    return successResponse(res, result, result.message);
  } catch (err) {
    console.error("[BusinessEmail] testConfig error:", err);
    return errorResponse(res, err.message, 400);
  }
};

//////////////////////////////////////////////////////
// TOGGLE BUSINESS EMAIL STATUS (ENABLE / DISABLE)
//////////////////////////////////////////////////////
exports.toggleStatus = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { isEnabled } = req.body;

    const existing = await getBusinessEmailConfig(businessId);
    if (!existing) {
      return errorResponse(res, "Business email configuration not found. Please save configuration first.", 404);
    }

    const updated = await prisma.businessEmailConfig.update({
      where: { businessId },
      data: {
        isEnabled: Boolean(isEnabled),
        updatedAt: new Date(),
      },
    });

    return successResponse(res, formatSafeConfig(updated), `Business email ${updated.isEnabled ? "enabled" : "disabled"} successfully`);
  } catch (err) {
    console.error("[BusinessEmail] toggleStatus error:", err);
    return errorResponse(res, err.message, 500);
  }
};

//////////////////////////////////////////////////////
// SEND BUSINESS EMAIL (INVOICES, PAYMENT REMINDERS, POs, HR)
//////////////////////////////////////////////////////
exports.sendEmail = async (req, res) => {
  try {
    const businessId = req.business.id;
    const {
      to,
      toEmail,
      subject,
      text,
      html,
      attachments,
      replyTo,
      cc,
      bcc,
      customerId,
      contactId,
      leadId,
      dealId,
      invoiceIds,
      quotationIds,
    } = req.body;

    let allAttachments = Array.isArray(attachments) ? [...attachments] : [];

    // Automatically resolve and attach portal invoices
    if (Array.isArray(invoiceIds) && invoiceIds.length > 0) {
      try {
        const invoices = await prisma.invoice.findMany({
          where: { id: { in: invoiceIds }, businessId, isDeleted: false },
          include: {
            customer: true,
            items: true,
            business: true,
          },
        });

        const settings = await prisma.settings.findUnique({ where: { businessId } });
        const generateInvoicePdfHelper = require("../utils/generateInvoicePdf");

        for (const inv of invoices) {
          if (inv.pdfUrl && (inv.pdfUrl.startsWith("http://") || inv.pdfUrl.startsWith("https://"))) {
            allAttachments.push({
              filename: `Invoice-${inv.invoiceNumber}.pdf`,
              path: inv.pdfUrl,
            });
          } else {
            try {
              const buf = await generateInvoicePdfHelper(inv, settings || {});
              allAttachments.push({
                filename: `Invoice-${inv.invoiceNumber}.pdf`,
                content: buf,
                contentType: "application/pdf",
              });
            } catch (pdfErr) {
              console.error(`[BusinessEmail] Failed to generate PDF for invoice ${inv.invoiceNumber}:`, pdfErr.message);
            }
          }
        }
      } catch (invErr) {
        console.error("[BusinessEmail] Error resolving invoice attachments:", invErr.message);
      }
    }

    // Automatically resolve and attach portal quotations
    if (Array.isArray(quotationIds) && quotationIds.length > 0) {
      try {
        const quotations = await prisma.quotation.findMany({
          where: { id: { in: quotationIds }, businessId, isDeleted: false },
          select: { id: true, quoteNumber: true, pdfUrl: true },
        });

        for (const q of quotations) {
          if (q.pdfUrl && (q.pdfUrl.startsWith("http://") || q.pdfUrl.startsWith("https://"))) {
            allAttachments.push({
              filename: `Quotation-${q.quoteNumber}.pdf`,
              path: q.pdfUrl,
            });
          }
        }
      } catch (quoteErr) {
        console.error("[BusinessEmail] Error resolving quotation attachments:", quoteErr.message);
      }
    }

    const result = await sendBusinessEmail(businessId, {
      to,
      toEmail,
      subject,
      text,
      html,
      attachments: allAttachments,
      replyTo,
      cc,
      bcc,
      customerId,
      contactId,
      leadId,
      dealId,
    }, { fallbackToPlatform: true });

    // Auto-save recipient email as CustomerContact if missing so future communications auto-fetch
    const effectiveRecipient = (toEmail || to || "").trim();
    if (customerId && effectiveRecipient) {
      try {
        const existingContact = await prisma.customerContact.findFirst({
          where: {
            customerId,
            businessId,
            isDeleted: false,
            email: { equals: effectiveRecipient, mode: "insensitive" },
          },
        });
        if (!existingContact) {
          const cust = await prisma.customer.findUnique({ where: { id: customerId } });
          const hasAnyContact = await prisma.customerContact.findFirst({
            where: { customerId, businessId, isDeleted: false },
          });
          await prisma.customerContact.create({
            data: {
              businessId,
              customerId,
              fullName: cust?.company || "Primary Contact",
              email: effectiveRecipient,
              isPrimary: !hasAnyContact, // make primary if customer had no previous contacts
            },
          });
        }
      } catch (saveContactErr) {
        console.error("[BusinessEmail] Auto-save customer contact note:", saveContactErr.message);
      }
    }

    return successResponse(res, result, "Email dispatched successfully");
  } catch (err) {
    console.error("[BusinessEmail] sendEmail error:", err);
    return errorResponse(res, err.message, 500);
  }
};

