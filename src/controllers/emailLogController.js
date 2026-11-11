const prisma = require("../config/prisma");
const crypto = require("crypto");
const { sendBusinessEmail, getBusinessEmailConfig } = require("../utils/businessMailer");
const { sendEmail } = require("../utils/mailer");

exports.getEmailLogs = async (req, res) => {
  try {
    const logs = await prisma.emailLog.findMany({
      where: { businessId: req.business.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEmailLog = async (req, res) => {
  try {
    const businessId = req.business.id;
    const config = await getBusinessEmailConfig(businessId);

    // 1. If custom business SMTP is configured and enabled, send via business SMTP
    if (config && config.isEnabled && config.smtpHost && config.smtpUser) {
      try {
        const sendResult = await sendBusinessEmail(businessId, {
          toEmail: req.body.toEmail,
          subject: req.body.subject,
          text: req.body.body,
          html: req.body.body,
          customerId: req.body.customerId,
          contactId: req.body.contactId,
          leadId: req.body.leadId,
          dealId: req.body.dealId,
          attachments: req.body.attachments,
        });

        const log = await prisma.emailLog.findUnique({
          where: { id: sendResult.emailLogId },
        });

        return res.status(201).json({ success: true, data: log, message: "Email dispatched via custom business SMTP." });
      } catch (emailErr) {
        console.warn("[EmailLog] Business SMTP failed, falling back to default platform mailer:", emailErr.message);
      }
    }

    // 2. Fallback: Default QUE ERP platform mailer
    let deliveryStatus = "SENT";
    try {
      await sendEmail(
        req.body.toEmail,
        req.body.subject,
        req.body.body,
        req.body.body
      );
      deliveryStatus = "SENT";
    } catch (emailErr) {
      console.error("[EmailLog] Default mailer error:", emailErr.message);
      deliveryStatus = "FAILED";
    }

    const log = await prisma.emailLog.create({
      data: {
        id: crypto.randomUUID(),
        businessId: req.business.id,
        toEmail: req.body.toEmail,
        fromEmail: req.body.fromEmail || "noreply@queinfotech.com",
        subject: req.body.subject,
        body: req.body.body,
        status: deliveryStatus,
        customerId: req.body.customerId || null,
        contactId: req.body.contactId || null,
        leadId: req.body.leadId || null,
        dealId: req.body.dealId || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: log,
      message: "Email dispatched successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
