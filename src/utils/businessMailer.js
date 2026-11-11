const nodemailer = require("nodemailer");
const prisma = require("../config/prisma");
const { decrypt } = require("./cryptoUtils");

/**
 * Retrieves the business email configuration for a given businessId
 * @param {string} businessId
 * @returns {Promise<Object|null>}
 */
async function getBusinessEmailConfig(businessId) {
  if (!businessId) return null;
  return await prisma.businessEmailConfig.findUnique({
    where: { businessId },
  });
}

/**
 * Creates a nodemailer transporter using the business's custom SMTP settings.
 * IMPORTANT: If email is not configured or disabled, this throws an error.
 * It NEVER silently falls back to QUE ERP system email!
 * 
 * @param {string|Object} configOrBusinessId
 * @returns {Promise<{ transporter: Object, config: Object }>}
 */
async function createBusinessTransporter(configOrBusinessId) {
  let config = configOrBusinessId;

  if (typeof configOrBusinessId === "string") {
    config = await getBusinessEmailConfig(configOrBusinessId);
  }

  if (!config) {
    const error = new Error(
      "Business email is not configured. Please configure your business SMTP settings in Administration > Business Email."
    );
    error.code = "BUSINESS_EMAIL_NOT_CONFIGURED";
    error.statusCode = 400;
    throw error;
  }

  if (!config.isEnabled) {
    const error = new Error(
      "Business email is disabled. Please enable it in Administration > Business Email to send emails."
    );
    error.code = "BUSINESS_EMAIL_DISABLED";
    error.statusCode = 400;
    throw error;
  }

  if (!config.smtpHost || !config.smtpUser || !config.smtpPassEncrypted) {
    const error = new Error(
      "Incomplete business email configuration. Please ensure SMTP Host, Port, Username, and Password are all saved."
    );
    error.code = "BUSINESS_EMAIL_INCOMPLETE";
    error.statusCode = 400;
    throw error;
  }

  let plainPassword;
  try {
    plainPassword = decrypt(config.smtpPassEncrypted);
  } catch (decErr) {
    throw new Error("Failed to decrypt SMTP credentials: " + decErr.message);
  }

  const port = Number(config.smtpPort) || 587;
  const isSecure = config.encryption === "SSL" || port === 465;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: port,
    secure: isSecure,
    auth: {
      user: config.smtpUser,
      pass: plainPassword,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return { transporter, config };
}

/**
 * Sends a business-level email (Invoices, payment reminders, employee notices, vendor POs, customer updates)
 * strictly using the business's own SMTP settings.
 * 
 * @param {string} businessId
 * @param {Object} options { to, subject, text, html, attachments, replyTo, cc, bcc, customerId, contactId, leadId, dealId }
 * @returns {Promise<Object>}
 */
async function sendBusinessEmail(businessId, options = {}, flags = {}) {
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
  } = options;

  const recipient = to || toEmail;
  if (!recipient) {
    throw new Error("Recipient email address (to) is required.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  let transporter = null;
  let config = null;

  try {
    const result = await createBusinessTransporter(businessId);
    transporter = result.transporter;
    config = result.config;
  } catch (transporterErr) {
    if (flags.fallbackToPlatform) {
      const { createTransporter } = require("./mailer");
      transporter = createTransporter();
      config = {
        email: process.env.EMAIL_FROM || "noreply@queinfotech.com",
        senderName: options.senderName || "QueErp Business Communications",
      };
      console.warn(`[BUSINESS MAILER] Using default platform mailer fallback: ${transporterErr.message}`);
    } else {
      throw transporterErr;
    }
  }

  const fromAddress = config.senderName
    ? `"${config.senderName}" <${config.email}>`
    : config.email;

  const mailOptions = {
    from: fromAddress,
    to: recipient,
    subject: subject,
    text: text || html?.replace(/<[^>]+>/g, " ") || "",
    html: html || (text ? `<p style="white-space: pre-wrap;">${text}</p>` : ""),
    replyTo: replyTo || config.email,
  };

  if (cc) mailOptions.cc = cc;
  if (bcc) mailOptions.bcc = bcc;
  if (attachments && Array.isArray(attachments)) mailOptions.attachments = attachments;

  let deliveryStatus = "SENT";
  let messageId = null;
  let deliveryError = null;

  try {
    const info = await transporter.sendMail(mailOptions);
    messageId = info.messageId;
    console.log(`[BUSINESS MAILER] Email sent to ${recipient} via ${config.email} (${config.smtpHost}). MessageId: ${messageId}`);
  } catch (sendErr) {
    deliveryStatus = "FAILED";
    deliveryError = sendErr.message;
    console.error(`[BUSINESS MAILER ERROR] Failed to send email to ${recipient} via ${config.email}:`, sendErr.message);
  }

  // 2. Automatically log the business email to EmailLog for audit & tracking
  let emailLog = null;
  try {
    emailLog = await prisma.emailLog.create({
      data: {
        businessId,
        subject,
        body: html || text || "",
        fromEmail: config.email,
        toEmail: recipient,
        status: deliveryStatus,
        customerId: customerId || null,
        contactId: contactId || null,
        leadId: leadId || null,
        dealId: dealId || null,
        attachments: attachments ? attachments.map(a => ({ filename: a.filename, path: a.path || null })) : null,
      },
    });
  } catch (logErr) {
    console.warn(`[BUSINESS MAILER] Failed to write EmailLog:`, logErr.message);
  }

  if (deliveryStatus === "FAILED") {
    throw new Error(`Failed to send email via business SMTP (${config.email}): ${deliveryError}`);
  }

  return {
    success: true,
    messageId,
    emailLogId: emailLog?.id || null,
    fromEmail: config.email,
    toEmail: recipient,
  };
}

/**
 * Tests a business SMTP configuration (either saved or in-flight preview) by verifying connection and sending a test email.
 * 
 * @param {string} businessId
 * @param {Object} testPayload
 * @returns {Promise<Object>}
 */
async function testBusinessEmail(businessId, testPayload = {}) {
  const {
    recipientEmail,
    email,
    senderName,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    encryption,
  } = testPayload;

  if (!recipientEmail) {
    throw new Error("Recipient email address is required to perform a test email.");
  }

  let finalHost = smtpHost;
  let finalPort = Number(smtpPort) || 587;
  let finalUser = smtpUser;
  let finalPass = smtpPass;
  let finalEncryption = encryption || "TLS";
  let finalEmail = email;
  let finalSenderName = senderName || "Business Administrator";

  // If in-flight password is not supplied, try to pull existing encrypted password
  if (!finalPass && businessId) {
    const existing = await getBusinessEmailConfig(businessId);
    if (existing && existing.smtpPassEncrypted) {
      finalPass = decrypt(existing.smtpPassEncrypted);
      if (!finalHost) finalHost = existing.smtpHost;
      if (!finalPort) finalPort = existing.smtpPort;
      if (!finalUser) finalUser = existing.smtpUser;
      if (!finalEncryption) finalEncryption = existing.encryption;
      if (!finalEmail) finalEmail = existing.email;
      if (!finalSenderName) finalSenderName = existing.senderName;
    }
  }

  if (!finalHost || !finalUser || !finalPass || !finalEmail) {
    throw new Error("Missing required SMTP connection parameters: Host, User, Password, and Email Address are required.");
  }

  const isSecure = finalEncryption === "SSL" || finalPort === 465;

  const testTransporter = nodemailer.createTransport({
    host: finalHost,
    port: finalPort,
    secure: isSecure,
    auth: {
      user: finalUser,
      pass: finalPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // 1. Verify SMTP handshake & credentials
  try {
    await testTransporter.verify();
  } catch (verifyErr) {
    const errMsg = `SMTP Connection failed: ${verifyErr.message}`;
    if (businessId) {
      await prisma.businessEmailConfig.updateMany({
        where: { businessId },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: "FAILED",
          lastTestError: verifyErr.message,
          isVerified: false,
        },
      });
    }
    throw new Error(errMsg);
  }

  // 2. Send verified test email
  const fromAddress = finalSenderName
    ? `"${finalSenderName}" <${finalEmail}>`
    : finalEmail;

  const mailOptions = {
    from: fromAddress,
    to: recipientEmail,
    subject: `SMTP Verification Test - ${finalSenderName} (QUE ERP)`,
    text: `Hello,\n\nThis is a test email sent from QUE ERP to verify your business email configuration.\n\nConfiguration Details:\n- Business Email: ${finalEmail}\n- SMTP Host: ${finalHost}\n- SMTP Port: ${finalPort}\n- Encryption: ${finalEncryption}\n- Sender Display Name: ${finalSenderName}\n\nYour business email configuration has been successfully verified!\n\nBest regards,\nQUE ERP Business Email System`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 26px; font-weight: 800;">QUE ERP</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Business Email Verification</p>
        </div>

        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <span style="background-color: #d1fae5; color: #065f46; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase;">
            ✅ SMTP Verified
          </span>
          <h3 style="color: #065f46; font-size: 18px; font-weight: 800; margin: 10px 0 4px 0;">
            Connection Established Successfully!
          </h3>
          <p style="color: #047857; font-size: 13px; margin: 0;">
            Your custom business email server is working properly.
          </p>
        </div>

        <p style="color: #1e293b; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          All business communications including customer invoices, payment reminders, employee notifications, and vendor purchase orders can now be dispatched securely from <strong>${finalEmail}</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Verified Parameters:</h4>
          <table style="width: 100%; font-size: 13px; color: #334155;">
            <tr><td style="padding: 4px 0; color: #64748b; width: 40%;">Business Email:</td><td><strong>${finalEmail}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Sender Name:</td><td><strong>${finalSenderName}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">SMTP Host:</td><td><strong>${finalHost}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">SMTP Port:</td><td><strong>${finalPort}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Encryption:</td><td><strong>${finalEncryption}</strong></td></tr>
          </table>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          Sent by QUE ERP Business-Wise Email Engine &bull; Multi-Tenant Isolation Active
        </p>
      </div>
    `,
  };

  const info = await testTransporter.sendMail(mailOptions);

  // 3. Mark verified in DB if saved config exists
  if (businessId) {
    await prisma.businessEmailConfig.updateMany({
      where: { businessId },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: "SUCCESS",
        lastTestError: null,
        isVerified: true,
      },
    });
  }

  return {
    success: true,
    messageId: info.messageId,
    message: `Test email sent successfully to ${recipientEmail}`,
  };
}

module.exports = {
  getBusinessEmailConfig,
  createBusinessTransporter,
  sendBusinessEmail,
  testBusinessEmail,
};

