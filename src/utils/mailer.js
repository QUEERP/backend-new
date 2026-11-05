const nodemailer = require("nodemailer");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.queinfotech.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      // do not fail on invalid/expired certs
      rejectUnauthorized: false
    }
  });
};

/**
 * Sends a password reset email
 */
const sendResetEmail = async (toEmail, userName, resetToken) => {
  const transporter = createTransporter();
  const frontEndUrl = process.env.FRONTEND_URL || 'https://erp.queinfotech.com';
  const resetLink = `${frontEndUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"QueErp Support" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Reset Your QueErp Password",
    text: `Hello ${userName},\n\nWe received a request to reset your password.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, simply ignore this email.\n\nBest regards,\nQueErp Support Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.5px;">QueErp</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Global Cloud ERP Platform</p>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 10px 0;">Reset Your Password</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0;">Hello <strong>${userName}</strong>, we received a request to reset your password. Click the button below to choose a new password.</p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 8px 20px rgba(37,99,235,0.35);">Reset Password &rarr;</a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.6; text-align: center; margin-bottom: 0;">
          This link will expire in 1 hour. If you did not request this reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          &copy; ${new Date().getFullYear()} QueErp Technologies. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("[MAILER] Reset email sent to " + toEmail + " MessageId: " + info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[MAILER ERROR] Failed to send reset email:", error);
    throw error;
  }
};

/**
 * Helper to determine frontEndUrl from clientOrigin or environment
 */
const resolveFrontendUrl = (clientOrigin = null) => {
  let frontEndUrl = process.env.FRONTEND_URL || 'https://erp.queinfotech.com';
  if (clientOrigin && typeof clientOrigin === 'string' && clientOrigin.startsWith('http')) {
    try {
      const parsed = new URL(clientOrigin);
      frontEndUrl = parsed.origin;
    } catch {
      // Fallback to configured FRONTEND_URL
    }
  }
  return frontEndUrl.replace(/\/$/, '');
};

/**
 * Sends an attractive welcome email when a user signs up (with global country, currency, and statutory tax details)
 */
const sendSignupWelcomeEmail = async (toEmail, userName, trialDays = 90, clientOrigin = null) => {
  const transporter = createTransporter();
  const frontEndUrl = resolveFrontendUrl(clientOrigin);
  const loginLink = `${frontEndUrl}/signin?from_email=true&email=${encodeURIComponent(toEmail)}`;

  const hasTrial = trialDays && trialDays > 0;

  const mailOptions = {
    from: `"QueErp Welcome Team" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: hasTrial
      ? `Welcome to QueErp - Your ${trialDays}-Day Free Trial is Active! 🎉`
      : `Welcome to QueErp - Your Global ERP Platform! 🎉`,
    text: `Hello ${userName},\n\nWelcome to QueErp!\n\nYour account has been successfully created${hasTrial ? ` with an exclusive ${trialDays}-Day All-Inclusive Free Trial` : ''}.\n\nSign in to set up your business and start managing your operations:\n${loginLink}\n\nGlobal Enterprise Capabilities:\n- All Countries & 160+ Currencies Supported: Native multi-currency ledgers with real-time exchange rates.\n- Country-Specific Statutory Tax Engine: Dynamic tax rules and filing returns tailored to your business country (UAE FTA VAT, Indian GST, Saudi ZATCA, European VAT, US Sales Tax).\n- Project Operations & Milestones: Commercial milestone billing, dependencies, and progress tracking.\n- Inventory & Multi-Warehouse: Real-time stock movement, FIFO/WAC valuation, and batch tracking.\n\nSign in now:\n${loginLink}\n\nBest regards,\nThe QueErp Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 25px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -0.5px;">QueErp</h1>
          <p style="color: #64748b; font-size: 13px; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Global Cloud ERP &amp; Financial Platform</p>
        </div>

        <!-- Attractive Hero Banner -->
        ${hasTrial ? `
        <div style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%); border-radius: 14px; padding: 26px 20px; margin-bottom: 28px; text-align: center; color: #ffffff; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);">
          <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 5px 14px; border-radius: 30px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.3);">
            ⭐ 90-Day Free Trial Activated
          </div>
          <h2 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.3px;">Welcome to Enterprise Power</h2>
          <p style="color: #dbeafe; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 500;">
            Your 90-day complimentary trial is fully active with zero setup fees or credit card required.
          </p>
        </div>
        ` : `
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 14px; padding: 26px 20px; margin-bottom: 28px; text-align: center; color: #ffffff; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);">
          <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); padding: 5px 14px; border-radius: 30px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
            Account Configured
          </div>
          <h2 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 6px 0;">Welcome to QueErp</h2>
          <p style="color: #cbd5e1; font-size: 14px; margin: 0; line-height: 1.5;">
            Your account is ready to manage worldwide operations with financial precision.
          </p>
        </div>
        `}

        <!-- Personalized Greeting -->
        <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 12px 0;">
          Hello <strong>${userName}</strong>,
        </p>
        <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
          Thank you for choosing <strong>QueErp</strong>. Our platform provides complete financial visibility, automated statutory compliance, and streamlined project &amp; inventory workflows designed to adapt seamlessly to your business anywhere in the world.
        </p>

        <!-- Global Features Grid / Highlights -->
        <div style="margin: 28px 0; background-color: #f8fafc; border-radius: 14px; padding: 22px 20px; border: 1px solid #e2e8f0;">
          <h3 style="color: #0f172a; font-size: 15px; font-weight: 800; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            🌍 Built for Global Enterprise Operations
          </h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; vertical-align: top; width: 28px; font-size: 18px;">🌐</td>
              <td style="padding: 10px 0 10px 10px; vertical-align: top;">
                <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 3px;">All Countries &amp; All Currencies Supported</strong>
                <span style="color: #64748b; font-size: 13px; line-height: 1.5; display: block;">
                  Seamlessly operate in any country with full native support for 160+ currencies (AED, USD, EUR, GBP, SAR, INR, QAR, CAD, AUD, etc.) featuring live exchange rates and automated forex gain/loss ledgers.
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; vertical-align: top; width: 28px; font-size: 18px; border-top: 1px solid #edf2f7;">🏛️</td>
              <td style="padding: 10px 0 10px 10px; vertical-align: top; border-top: 1px solid #edf2f7;">
                <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 3px;">Country-Specific Statutory Tax Engine</strong>
                <span style="color: #64748b; font-size: 13px; line-height: 1.5; display: block;">
                  Tax categories, calculation rules, and statutory reports are dynamically defined by your business's registered country — automatically provisioning UAE FTA VAT 201, Indian CBIC GST, Saudi ZATCA e-invoicing, European VAT, US Sales Tax, and localized international tax frameworks.
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; vertical-align: top; width: 28px; font-size: 18px; border-top: 1px solid #edf2f7;">📊</td>
              <td style="padding: 10px 0 10px 10px; vertical-align: top; border-top: 1px solid #edf2f7;">
                <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 3px;">Project Operations &amp; Milestone Billing</strong>
                <span style="color: #64748b; font-size: 13px; line-height: 1.5; display: block;">
                  End-to-end master planning, predecessor dependencies, contract milestones, commercial payment weighting caps, and real-time deliverable progress rollups.
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; vertical-align: top; width: 28px; font-size: 18px; border-top: 1px solid #edf2f7;">📦</td>
              <td style="padding: 10px 0 10px 10px; vertical-align: top; border-top: 1px solid #edf2f7;">
                <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 3px;">Multi-Warehouse Inventory &amp; Procurement</strong>
                <span style="color: #64748b; font-size: 13px; line-height: 1.5; display: block;">
                  Multi-location stock movement, batch &amp; expiry tracking, purchase orders, vendor registers, automated reorder triggers, and FIFO valuation.
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin: 34px 0 28px 0;">
          <a href="${loginLink}" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 16px 44px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 16px; display: inline-block; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.45); letter-spacing: 0.3px;">
            Sign In to QueErp &rarr;
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">
            Click to sign in with your email (${toEmail}) and open your dashboard
          </p>
        </div>

        <!-- 3-Step Setup Guide -->
        <div style="background-color: #f1f5f9; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h4 style="color: #334155; font-size: 13px; font-weight: 700; margin: 0 0 8px 0; text-transform: uppercase;">Quick 3-Minute Setup:</h4>
          <ol style="color: #475569; font-size: 13px; line-height: 1.7; margin: 0; padding-left: 18px;">
            <li>Sign in using your registered email and password.</li>
            <li>Create your business and select your country — your local currency, tax rates, and statutory reports will be auto-provisioned!</li>
            <li>Invite your managers and start billing, tracking projects, and generating financial statements.</li>
          </ol>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 26px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center; line-height: 1.6;">
          Need assistance or onboarding support? Reply directly to this email or visit our Help Center.<br />
          &copy; ${new Date().getFullYear()} QueErp Technologies. Global Cloud ERP. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Welcome signup email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send signup welcome email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Sends an attractive email when a business is created with a 90-day free trial
 */
const sendBusinessTrialActivatedEmail = async (toEmail, userName, businessName, expiresAt, businessId = null, clientOrigin = null) => {
  const transporter = createTransporter();
  const frontEndUrl = resolveFrontendUrl(clientOrigin);
  const loginLink = businessId
    ? `${frontEndUrl}/signin?from_email=true&email=${encodeURIComponent(toEmail)}&businessId=${encodeURIComponent(businessId)}`
    : `${frontEndUrl}/signin?from_email=true&email=${encodeURIComponent(toEmail)}`;
  const expiryFormatted = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '90 days from today';

  const mailOptions = {
    from: `"QueErp Subscriptions" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Business "${businessName}" Activated - 90-Day Free Trial 🎉`,
    text: `Hello ${userName},\n\nYour business "${businessName}" has been successfully created and your 90-Day Free Trial is now active!\n\nTrial Expiration Date: ${expiryFormatted}\n\nSign in to access your business dashboard:\n${loginLink}\n\nAll countries, currencies, and localized statutory tax reports are now enabled for ${businessName}.\n\nBest regards,\nQueErp Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 28px; font-weight: 900;">QueErp</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Subscription &amp; Business Activation</p>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 22px; margin-bottom: 24px; text-align: center; color: #ffffff; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);">
          <span style="background-color: rgba(255,255,255,0.2); color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
            🎉 Trial Activated
          </span>
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 10px 0 4px 0;">${businessName} is Live!</h2>
          <p style="color: #d1fae5; font-size: 13px; margin: 0; font-weight: 500;">90 days of complete enterprise features unlocked.</p>
        </div>

        <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">Hello <strong>${userName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Your business <strong>${businessName}</strong> has been configured with our <strong>90-Day All-Inclusive Free Trial</strong>. All multi-currency ledgers, inventory tracking, project operations, and country-specific statutory tax compliance reports are active.
        </p>

        <div style="margin: 20px 0; padding: 18px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Trial Expiration Date</span>
            <strong style="color: #0f172a; font-size: 16px;">${expiryFormatted}</strong>
          </div>
          <span style="background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 20px;">
            ⭐ 90 Days Remaining
          </span>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginLink}" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 8px 20px rgba(37,99,235,0.35);">
            Sign In to Business Dashboard &rarr;
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">
            Sign in as ${toEmail} to access ${businessName}
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          &copy; ${new Date().getFullYear()} QueErp Technologies. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Business trial activated email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send business trial email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Sends an attractive notification email when a subscription deadline is approaching or ended
 */
const sendSubscriptionDeadlineEmail = async (toEmail, userName, businessName, expiryDate, daysRemaining, isExpired = false, businessId = null, clientOrigin = null) => {
  const transporter = createTransporter();
  const frontEndUrl = resolveFrontendUrl(clientOrigin);
  const loginLink = businessId
    ? `${frontEndUrl}/signin?from_email=true&email=${encodeURIComponent(toEmail)}&businessId=${encodeURIComponent(businessId)}`
    : `${frontEndUrl}/signin?from_email=true&email=${encodeURIComponent(toEmail)}`;
  const expiryFormatted = expiryDate ? new Date(expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Soon';

  const subject = isExpired
    ? `Action Required: Subscription Expired for "${businessName}" ⚠️`
    : `Reminder: Subscription Deadline Ending Soon for "${businessName}" (${daysRemaining} Days Left) ⏳`;

  const mailOptions = {
    from: `"QueErp Billing" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: subject,
    text: isExpired
      ? `Hello ${userName},\n\nYour subscription/trial deadline for "${businessName}" has ended on ${expiryFormatted}.\n\nTo continue accessing your invoices, accounting, inventory, and reports without disruption, please renew your subscription or contact your administrator.\n\nSign in to renew:\n${loginLink}\n\nBest regards,\nQueErp Billing Team`
      : `Hello ${userName},\n\nThis is a reminder that the subscription/trial deadline for "${businessName}" will end on ${expiryFormatted} (${daysRemaining} days remaining).\n\nTo ensure uninterrupted access to your enterprise services, please renew your plan.\n\nSign in to renew:\n${loginLink}\n\nBest regards,\nQueErp Billing Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 28px; font-weight: 900;">QueErp</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Subscription &amp; Licensing Notice</p>
        </div>

        <div style="background-color: ${isExpired ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${isExpired ? '#fecaca' : '#fde68a'}; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <span style="background-color: ${isExpired ? '#fee2e2' : '#fef3c7'}; color: ${isExpired ? '#991b1b' : '#92400e'}; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase;">
            ${isExpired ? '⚠️ Term Expired' : '⏳ Action Recommended'}
          </span>
          <h3 style="color: ${isExpired ? '#991b1b' : '#92400e'}; font-size: 18px; font-weight: 800; margin: 10px 0 4px 0;">
            ${isExpired ? 'Subscription Deadline Ended' : `Trial Ending in ${daysRemaining} Days`}
          </h3>
          <p style="color: ${isExpired ? '#b91c1c' : '#b45309'}; font-size: 13px; margin: 0;">
            ${isExpired
        ? `The active license for <strong>${businessName}</strong> ended on ${expiryFormatted}.`
        : `The active license for <strong>${businessName}</strong> ends on ${expiryFormatted}.`
      }
          </p>
        </div>

        <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">Hello <strong>${userName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          ${isExpired
        ? `Your business license for <strong>${businessName}</strong> has reached its expiration date. To prevent any disruption to your multi-currency invoicing, VAT/GST filing reports, or project operations, please renew or upgrade your license.`
        : `We wanted to remind you that your license for <strong>${businessName}</strong> will expire soon. Renewing today guarantees uninterrupted day-to-day operations and team access.`
      }
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginLink}" style="background: linear-gradient(135deg, ${isExpired ? '#dc2626' : '#2563eb'} 0%, ${isExpired ? '#b91c1c' : '#1d4ed8'} 100%); color: #ffffff; padding: 14px 38px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 8px 20px rgba(37,99,235,0.3);">
            ${isExpired ? 'Renew License Now &rarr;' : 'Review Subscription &rarr;'}
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          &copy; ${new Date().getFullYear()} QueErp Technologies. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Subscription deadline email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send subscription deadline email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Generic email sender
 */
const sendEmail = async (toEmail, subject, textBody, htmlBody) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"QueErp Notifications" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: subject,
    text: textBody,
    html: htmlBody,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Custom email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send custom email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendResetEmail,
  sendSignupWelcomeEmail,
  sendBusinessTrialActivatedEmail,
  sendSubscriptionDeadlineEmail,
  sendEmail,
};
