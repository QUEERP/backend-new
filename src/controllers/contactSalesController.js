const nodemailer = require("nodemailer");

/**
 * Creates the platform SMTP transporter using system credentials
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "mail.queinfotech.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "queerp@queinfotech.com",
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Handles Contact Sales and Pricing Inquiry submissions from the landing page
 */
exports.submitSalesInquiry = async (req, res) => {
  try {
    const {
      type, // 'contact_sales' | 'price_inquiry'
      name,
      companyName,
      email,
      companyEmail,
      country,
      phone,
      message,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Full Name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email Address is required." });
    }
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ success: false, message: "Company Name is required." });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: "Phone Number is required." });
    }
    if (!country || !country.trim()) {
      return res.status(400).json({ success: false, message: "Country is required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const recipientEmail = "queerp@queinfotech.com";
    const isPriceInquiry = type === "price_inquiry";
    const inquiryTitle = isPriceInquiry
      ? "New Pricing & Plan Details Request"
      : "New Enterprise Sales Inquiry";

    const subject = `[QueErp Inquiry] ${inquiryTitle} from ${companyName.trim()} (${name.trim()})`;

    const submittedAt = new Date().toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: "Asia/Kolkata",
    });

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .container { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06); }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
          .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; border: 1px solid rgba(255, 255, 255, 0.3); }
          .content { padding: 28px 24px; }
          .field-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          .field-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .field-label { width: 38%; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
          .field-value { font-weight: 600; color: #0f172a; }
          .cta-box { text-align: center; margin: 28px 0 12px 0; }
          .cta-btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; }
          .footer { text-align: center; padding: 16px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">${isPriceInquiry ? "PRICING CONNECT INQUIRY" : "ENTERPRISE CONTACT SALES"}</div>
            <h2 style="margin: 0; font-size: 22px; font-weight: 800;">${inquiryTitle}</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Submitted via QueErp Public Landing Page</p>
          </div>

          <div class="content">
            <p style="font-size: 14px; color: #334155; margin-top: 0;">
              A prospective customer has submitted their information on the <strong>QueErp Pricing</strong> page requesting ${isPriceInquiry ? "more details on pricing" : "custom enterprise sales consultation"}.
            </p>

            <table class="field-table">
              <tr>
                <td class="field-label">Contact Person</td>
                <td class="field-value">${name.trim()}</td>
              </tr>
              <tr>
                <td class="field-label">Primary Email</td>
                <td class="field-value"><a href="mailto:${email.trim()}" style="color: #2563eb;">${email.trim()}</a></td>
              </tr>
              <tr>
                <td class="field-label">Company Name</td>
                <td class="field-value">${companyName.trim()}</td>
              </tr>
              ${companyEmail && companyEmail.trim() ? `
              <tr>
                <td class="field-label">Company Email</td>
                <td class="field-value"><a href="mailto:${companyEmail.trim()}" style="color: #2563eb;">${companyEmail.trim()}</a></td>
              </tr>
              ` : ""}
              <tr>
                <td class="field-label">Phone Number</td>
                <td class="field-value"><a href="tel:${phone.trim()}" style="color: #2563eb;">${phone.trim()}</a></td>
              </tr>
              <tr>
                <td class="field-label">Country</td>
                <td class="field-value">${country.trim()}</td>
              </tr>
              ${message && message.trim() ? `
              <tr>
                <td class="field-label">Message / Notes</td>
                <td class="field-value" style="font-weight: normal; color: #334155;">${message.trim()}</td>
              </tr>
              ` : ""}
              <tr>
                <td class="field-label">Submitted At</td>
                <td class="field-value" style="font-size: 12px; color: #64748b;">${submittedAt} IST</td>
              </tr>
            </table>

            <div class="cta-box">
              <a href="mailto:${email.trim()}?subject=Re:%20QueErp%20Pricing%20%26%20Plan%20Inquiry" class="cta-btn">
                Reply to ${name.trim()} &rarr;
              </a>
            </div>
          </div>

          <div class="footer">
            QueErp Inquiries • Notification dispatched to ${recipientEmail}
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
QueErp Inquiry: ${inquiryTitle}
----------------------------------------
Contact Person: ${name.trim()}
Email: ${email.trim()}
Company Name: ${companyName.trim()}
${companyEmail ? `Company Email: ${companyEmail.trim()}\n` : ""}Phone: ${phone.trim()}
Country: ${country.trim()}
${message ? `Message: ${message.trim()}\n` : ""}Submitted At: ${submittedAt}
    `;

    const transporter = createTransporter();

    // 1. Send notification to company admin (queerp@queinfotech.com)
    const adminInfo = await transporter.sendMail({
      from: `"QueErp Inquiries" <${process.env.SMTP_USER || "queerp@queinfotech.com"}>`,
      to: recipientEmail,
      replyTo: email.trim(),
      subject,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[SALES INQUIRY] Dispatched admin notification to ${recipientEmail}. MessageId: ${adminInfo.messageId}`);

    // 2. Send confirmation copy to the user
    const userSubject = isPriceInquiry
      ? `Thank you for contacting QueErp - Pricing Inquiry Received`
      : `Thank you for contacting QueErp - Enterprise Sales Inquiry Received`;

    const userHtmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .container { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06); }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
          .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; border: 1px solid rgba(255, 255, 255, 0.3); }
          .content { padding: 28px 24px; }
          .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
          .field-table { width: 100%; border-collapse: collapse; }
          .field-table td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .field-table tr:last-child td { border-bottom: none; }
          .field-label { width: 38%; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
          .field-value { font-weight: 600; color: #0f172a; }
          .next-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 18px; margin: 20px 0; }
          .footer { text-align: center; padding: 18px 24px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">INQUIRY CONFIRMATION</div>
            <h2 style="margin: 0; font-size: 22px; font-weight: 800;">We've Received Your Request</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">QueErp Enterprise Cloud Platform</p>
          </div>

          <div class="content">
            <p style="font-size: 15px; color: #1e293b; margin-top: 0; line-height: 1.6;">
              Dear <strong>${name.trim()}</strong>,
            </p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              Thank you for reaching out to QueErp regarding <strong>${companyName.trim()}</strong>. We have successfully logged your ${isPriceInquiry ? "custom pricing inquiry" : "enterprise sales consultation request"}. Below is a copy of the details you submitted:
            </p>

            <div class="summary-card">
              <table class="field-table">
                <tr>
                  <td class="field-label">Contact Person</td>
                  <td class="field-value">${name.trim()}</td>
                </tr>
                <tr>
                  <td class="field-label">Company Name</td>
                  <td class="field-value">${companyName.trim()}</td>
                </tr>
                <tr>
                  <td class="field-label">Email Address</td>
                  <td class="field-value">${email.trim()}</td>
                </tr>
                ${companyEmail && companyEmail.trim() ? `
                <tr>
                  <td class="field-label">Company Email</td>
                  <td class="field-value">${companyEmail.trim()}</td>
                </tr>
                ` : ""}
                <tr>
                  <td class="field-label">Phone Number</td>
                  <td class="field-value">${phone.trim()}</td>
                </tr>
                <tr>
                  <td class="field-label">Country</td>
                  <td class="field-value">${country.trim()}</td>
                </tr>
                ${message && message.trim() ? `
                <tr>
                  <td class="field-label">Notes / Message</td>
                  <td class="field-value" style="font-weight: normal;">${message.trim()}</td>
                </tr>
                ` : ""}
                <tr>
                  <td class="field-label">Submitted On</td>
                  <td class="field-value" style="font-size: 12px; color: #64748b;">${submittedAt} IST</td>
                </tr>
              </table>
            </div>

            <div class="next-box">
              <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 700;">What happens next?</h4>
              <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                Our enterprise solutions specialist is reviewing your requirements and will reach out to you via email or phone shortly to discuss your custom plan and scheduling.
              </p>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              If you have any urgent questions or updates, simply reply directly to this email or reach us at <a href="mailto:queerp@queinfotech.com" style="color: #2563eb; font-weight: 600;">queerp@queinfotech.com</a>.
            </p>

            <p style="font-size: 14px; color: #1e293b; margin-bottom: 0;">
              Best regards,<br>
              <strong>The QueErp Team</strong><br>
              <span style="font-size: 12px; color: #64748b;">Enterprise Business & Financial Operations</span>
            </p>
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} QueErp • Automated confirmation sent to ${email.trim()}
          </div>
        </div>
      </body>
      </html>
    `;

    const userTextBody = `
Dear ${name.trim()},

Thank you for reaching out to QueErp! We have received your inquiry for ${companyName.trim()}.

Here is a copy of your submitted details:
- Contact Name: ${name.trim()}
- Company Name: ${companyName.trim()}
- Email: ${email.trim()}
${companyEmail ? `- Company Email: ${companyEmail.trim()}\n` : ""}- Phone: ${phone.trim()}
- Country: ${country.trim()}
${message ? `- Notes: ${message.trim()}\n` : ""}- Submitted: ${submittedAt} IST

Our team will contact you shortly. If you need any immediate assistance, you can reply directly to this email or write to queerp@queinfotech.com.

Best regards,
The QueErp Team
    `;

    try {
      const userMailOptions = {
        from: `"QueErp Team" <${process.env.SMTP_USER || "queerp@queinfotech.com"}>`,
        to: email.trim(),
        replyTo: recipientEmail,
        subject: userSubject,
        text: userTextBody,
        html: userHtmlBody,
      };

      if (
        companyEmail &&
        companyEmail.trim() &&
        companyEmail.trim().toLowerCase() !== email.trim().toLowerCase()
      ) {
        userMailOptions.cc = companyEmail.trim();
      }

      const userInfo = await transporter.sendMail(userMailOptions);
      console.log(`[SALES INQUIRY] Dispatched confirmation copy to user ${email.trim()}. MessageId: ${userInfo.messageId}`);
    } catch (userMailErr) {
      console.error("[SALES INQUIRY] Failed to send user confirmation email:", userMailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Your inquiry has been submitted successfully. A confirmation email has also been sent to your email address!",
    });
  } catch (error) {
    console.error("[SALES INQUIRY ERROR]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit inquiry. Please try again later.",
    });
  }
};

