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
    const trimmedEmail = email.trim();
    const trimmedSenderName = (senderName && senderName.trim()) || req.business.name || "Business Administrator";
    const trimmedHost = smtpHost.trim();
    const trimmedUser = smtpUser.trim();
    const hasNewPass = Boolean(smtpPass && smtpPass.trim().length > 0);
    const connectionChanged = Boolean(
      !existing ||
      hasNewPass ||
      existing.email !== trimmedEmail ||
      existing.smtpHost !== trimmedHost ||
      existing.smtpPort !== port ||
      existing.smtpUser !== trimmedUser ||
      existing.encryption !== encType
    );

    const updated = await prisma.businessEmailConfig.upsert({
      where: { businessId },
      update: {
        email: trimmedEmail,
        senderName: trimmedSenderName,
        smtpHost: trimmedHost,
        smtpPort: port,
        smtpUser: trimmedUser,
        smtpPassEncrypted: encryptedPass,
        encryption: encType,
        isEnabled: activeState,
        ...(connectionChanged
          ? {
            isVerified: false,
            lastTestStatus: null,
            lastTestError: null,
          }
          : {}),
        updatedAt: new Date(),
      },
      create: {
        businessId,
        email: trimmedEmail,
        senderName: trimmedSenderName,
        smtpHost: trimmedHost,
        smtpPort: port,
        smtpUser: trimmedUser,
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

/**
 * Resolves an attachment PDF Buffer dynamically first, falling back to an
 * authenticated/verified HTTP fetch only when server-side generation fails.
 * Prevents passing blocked/401 remote URLs (e.g. Cloudinary free-tier PDFs) directly to nodemailer.
 */
async function resolvePdfBuffer({ label, pdfUrl, generateBuffer }) {
  try {
    const buf = await generateBuffer();
    if (buf && Buffer.byteLength(buf) > 0) {
      return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    }
  } catch (genErr) {
    console.error(`[BusinessEmail] Dynamic PDF generation failed for ${label}:`, genErr.message);
  }

  if (pdfUrl && (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://"))) {
    try {
      const response = await fetch(pdfUrl);
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        if (arrayBuf.byteLength > 0) {
          return Buffer.from(arrayBuf);
        }
      } else {
        console.warn(`[BusinessEmail] Remote PDF fetch returned HTTP ${response.status} for ${label}`);
      }
    } catch (fetchErr) {
      console.error(`[BusinessEmail] Remote PDF fetch failed for ${label}:`, fetchErr.message);
    }
  }

  return null;
}

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

    const hasInvoiceIds = Array.isArray(invoiceIds) && invoiceIds.length > 0;
    const hasQuotationIds = Array.isArray(quotationIds) && quotationIds.length > 0;

    if (hasInvoiceIds || hasQuotationIds) {
      const [settings, business] = await Promise.all([
        prisma.settings.findUnique({ where: { businessId } }),
        prisma.business.findUnique({ where: { id: businessId } }),
      ]);

      const pdfSettings = {
        ...(settings || {}),
        businessType: business?.businessType || settings?.businessType || "Trading",
        companyName: settings?.companyName || business?.name || "Your Company",
        address:
          settings?.address ||
          [business?.address, business?.city, business?.country].filter(Boolean).join(", "),
        phone: settings?.phone || business?.phone || "",
        email: settings?.email || business?.email || "",
        trn: settings?.trn || business?.vatNumber || business?.taxNumber || "",
        signatureUrl: settings?.signatureUrl || null,
      };

      // Automatically resolve and attach portal invoices (dynamic Buffer first to avoid Cloudinary 401 delivery blocks)
      if (hasInvoiceIds) {
        const invoices = await prisma.invoice.findMany({
          where: { id: { in: invoiceIds }, businessId, isDeleted: false },
          include: {
            customer: true,
            items: true,
            business: true,
          },
        });

        const generateInvoicePdfHelper = require("../utils/generateInvoicePdf");

        for (const inv of invoices) {
          const buf = await resolvePdfBuffer({
            label: `Invoice-${inv.invoiceNumber}`,
            pdfUrl: inv.pdfUrl,
            generateBuffer: () => generateInvoicePdfHelper(inv, { ...pdfSettings }),
          });

          if (!buf) {
            const pdfErr = new Error(`Failed to prepare PDF attachment for Invoice ${inv.invoiceNumber}.`);
            pdfErr.statusCode = 500;
            throw pdfErr;
          }

          allAttachments.push({
            filename: `Invoice-${inv.invoiceNumber}.pdf`,
            content: buf,
            contentType: "application/pdf",
          });
        }
      }

      // Automatically resolve and attach portal quotations (dynamic Buffer first to avoid Cloudinary 401 delivery blocks)
      if (hasQuotationIds) {
        const quotations = await prisma.quotation.findMany({
          where: { id: { in: quotationIds }, businessId, isDeleted: false },
          include: {
            customer: true,
            contact: true,
            items: { include: { product: true } },
            assignedTo: { include: { user: true } },
            deal: true,
          },
        });

        const generateQuotationPdfHelper = require("../utils/generateQuotationPdf");

        for (const q of quotations) {
          const buf = await resolvePdfBuffer({
            label: `Quotation-${q.quoteNumber}`,
            pdfUrl: q.pdfUrl,
            generateBuffer: () => generateQuotationPdfHelper(q, { ...pdfSettings }),
          });

          if (!buf) {
            const pdfErr = new Error(`Failed to prepare PDF attachment for Quotation ${q.quoteNumber}.`);
            pdfErr.statusCode = 500;
            throw pdfErr;
          }

          allAttachments.push({
            filename: `Quotation-${q.quoteNumber}.pdf`,
            content: buf,
            contentType: "application/pdf",
          });
        }
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
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

