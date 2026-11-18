const { htmlToPdfBuffer } = require("./launchBrowser");

/**
 * Generate a clean, professional Vendor Bill PDF Buffer
 * @param {object} bill - The Bill model record (with vendor and items)
 * @param {object} settings - Company / business settings
 * @returns {Promise<Buffer>}
 */
module.exports = async function generateVendorBillPdf(bill, settings = {}) {
  const companyName = settings.companyName || "Company";
  const companyAddress = settings.address || "";
  const companyPhone = settings.phone || "";
  const companyEmail = settings.email || "";
  const companyTrn = settings.trn || settings.taxNumber || settings.vatNumber || "";

  const vendorName = bill.vendor?.companyName || bill.vendor?.name || "Vendor";
  const vendorEmail = bill.vendor?.email || "";
  const vendorPhone = bill.vendor?.phone || "";
  const vendorAddress = [bill.vendor?.address, bill.vendor?.city, bill.vendor?.country].filter(Boolean).join(", ");
  const vendorTrn = bill.vendor?.taxRegistrationNumber || bill.vendor?.vatNumber || "";

  const currency = bill.currency || "INR";
  const billDate = bill.billDate ? new Date(bill.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
  const dueDate = bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
  const status = (bill.status || "UNPAID").toUpperCase();

  const items = Array.isArray(bill.items) ? bill.items : [];
  const subtotal = Number(bill.subtotal || items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.price || it.unitPrice || 0)), 0));
  const tax = Number(bill.tax || bill.taxAmount || 0);
  const discount = Number(bill.discount || 0);
  const totalAmount = Number(bill.totalAmount || (subtotal + tax - discount));
  const outstandingAmount = bill.outstandingAmount !== undefined ? Number(bill.outstandingAmount) : totalAmount;

  const fmt = (num) => Number(num || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rowsHtml = items.map((item, index) => {
    const itemName = item.name || item.description || item.product?.name || `Item ${index + 1}`;
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.price !== undefined ? item.price : (item.unitPrice !== undefined ? item.unitPrice : 0));
    const lineTotal = Number(item.totalAmount || (qty * unitPrice));
    const taxRate = item.taxPercent ? `${item.taxPercent}%` : "-";

    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-size: 13px; color: #64748b; text-align: center;">${index + 1}</td>
        <td style="padding: 10px 12px; font-size: 13px; font-weight: 500; color: #1e293b;">${itemName}</td>
        <td style="padding: 10px 12px; font-size: 13px; color: #334155; text-align: center;">${qty}</td>
        <td style="padding: 10px 12px; font-size: 13px; color: #334155; text-align: right;">${currency} ${fmt(unitPrice)}</td>
        <td style="padding: 10px 12px; font-size: 13px; color: #64748b; text-align: center;">${taxRate}</td>
        <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${currency} ${fmt(lineTotal)}</td>
      </tr>
    `;
  }).join("");

  const statusColor = status === "PAID" ? "#16a34a" : status === "OVERDUE" ? "#dc2626" : "#2563eb";
  const statusBg = status === "PAID" ? "#dcfce7" : status === "OVERDUE" ? "#fee2e2" : "#dbeafe";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Vendor Bill - ${bill.billNumber || "BILL"}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; padding: 36px; line-height: 1.45; }
      </style>
    </head>
    <body>
      <!-- HEADER -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">${companyName}</div>
            ${companyAddress ? `<div style="font-size: 12px; color: #64748b; margin-top: 4px;">${companyAddress}</div>` : ""}
            ${companyPhone || companyEmail ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">${[companyPhone, companyEmail].filter(Boolean).join(" • ")}</div>` : ""}
            ${companyTrn ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">TAX / VAT: ${companyTrn}</div>` : ""}
          </td>
          <td style="vertical-align: top; text-align: right;">
            <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: ${statusColor}; background: ${statusBg}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
              ${status}
            </div>
            <div style="font-size: 26px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.5px;">VENDOR BILL</div>
            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 4px;">${bill.billNumber || "BILL"}</div>
          </td>
        </tr>
      </table>

      <!-- VENDOR & DATES DETAILS -->
      <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
        <tr>
          <td style="width: 50%; padding: 14px 18px; vertical-align: top;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 6px;">VENDOR INFORMATION</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${vendorName}</div>
            ${vendorAddress ? `<div style="font-size: 12px; color: #475569; margin-top: 3px;">${vendorAddress}</div>` : ""}
            ${vendorEmail ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">${vendorEmail}</div>` : ""}
            ${vendorPhone ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">${vendorPhone}</div>` : ""}
            ${vendorTrn ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">TAX ID: ${vendorTrn}</div>` : ""}
          </td>
          <td style="width: 50%; padding: 14px 18px; vertical-align: top; text-align: right;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 6px;">BILL SUMMARY</div>
            <table style="margin-left: auto; border-collapse: collapse;">
              <tr>
                <td style="font-size: 12px; color: #64748b; padding: 2px 8px; text-align: right;">Bill Date:</td>
                <td style="font-size: 12px; font-weight: 600; color: #0f172a; padding: 2px 0; text-align: right;">${billDate}</td>
              </tr>
              <tr>
                <td style="font-size: 12px; color: #64748b; padding: 2px 8px; text-align: right;">Due Date:</td>
                <td style="font-size: 12px; font-weight: 600; color: #0f172a; padding: 2px 0; text-align: right;">${dueDate}</td>
              </tr>
              <tr>
                <td style="font-size: 12px; color: #64748b; padding: 2px 8px; text-align: right;">Currency:</td>
                <td style="font-size: 12px; font-weight: 600; color: #0f172a; padding: 2px 0; text-align: right;">${currency}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- LINE ITEMS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; width: 40px;">#</th>
            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">Item Description</th>
            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; width: 60px;">Qty</th>
            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: right; text-transform: uppercase; letter-spacing: 0.5px; width: 100px;">Unit Price</th>
            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; width: 60px;">Tax</th>
            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: right; text-transform: uppercase; letter-spacing: 0.5px; width: 110px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="6" style="padding: 18px; text-align: center; font-size: 12px; color: #94a3b8;">No line items recorded for this bill.</td></tr>`}
        </tbody>
      </table>

      <!-- TOTALS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
        <tr>
          <td style="vertical-align: top; width: 55%; padding-right: 20px;">
            ${bill.notes ? `
              <div style="background: #f8fafc; border-left: 3px solid #cbd5e1; padding: 12px 14px; border-radius: 4px;">
                <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Notes / Remarks</div>
                <div style="font-size: 12px; color: #64748b;">${bill.notes}</div>
              </div>
            ` : ""}
          </td>
          <td style="vertical-align: top; width: 45%;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Subtotal:</td>
                <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${currency} ${fmt(subtotal)}</td>
              </tr>
              ${discount > 0 ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #16a34a;">Discount:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #16a34a; text-align: right;">-${currency} ${fmt(discount)}</td>
                </tr>
              ` : ""}
              ${tax > 0 ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Tax Amount:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${currency} ${fmt(tax)}</td>
                </tr>
              ` : ""}
              <tr style="border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                <td style="padding: 10px 0; font-size: 15px; font-weight: 800; color: #0f172a;">Total Bill Amount:</td>
                <td style="padding: 10px 0; font-size: 16px; font-weight: 800; color: #0f172a; text-align: right;">${currency} ${fmt(totalAmount)}</td>
              </tr>
              ${outstandingAmount !== totalAmount ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #dc2626;">Outstanding Balance:</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #dc2626; text-align: right;">${currency} ${fmt(outstandingAmount)}</td>
                </tr>
              ` : ""}
            </table>
          </td>
        </tr>
      </table>

      <!-- FOOTER -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
        This is a computer-generated vendor bill statement from ${companyName}.
      </div>
    </body>
    </html>
  `;

  return await htmlToPdfBuffer(html, {
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });
};

