const prisma = require("../config/prisma");
const crypto = require("crypto");
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
    // 1. Send the actual email
    let deliveryStatus = req.body.status || "SENT";
    try {
      await sendEmail(
        req.body.toEmail,
        req.body.subject,
        req.body.body, // Text body
        req.body.body // Use same for HTML if not provided separately
      );
      deliveryStatus = "SENT";
    } catch (emailErr) {
      console.error("Failed to send email to " + req.body.toEmail, emailErr);
      deliveryStatus = "FAILED";
    }

    // 2. Log it to the database
    const log = await prisma.emailLog.create({
      data: {
        id: crypto.randomUUID(),
        ...req.body,
        status: deliveryStatus,
        businessId: req.business.id,
      },
    });
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
