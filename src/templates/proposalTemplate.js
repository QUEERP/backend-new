module.exports = (proposal, settings = {}) => {
  const getSymbol = (curr) => {
    if (!curr) return '₹';
    const c = curr.toUpperCase();
    if (c === 'INR') return '₹';
    if (c === 'SAR') return 'ر.س';
    if (c === 'AED') return 'د.إ';
    if (c === 'USD') return '$';
    if (c === 'EUR') return '€';
    if (c === 'GBP') return '£';
    if (c === 'QAR') return 'ر.ق';
    if (c === 'KWD') return 'د.ك';
    if (c === 'BHD') return '.د.ب';
    if (c === 'OMR') return 'ر.ع.';
    return curr;
  };
  const sym = getSymbol(proposal.currency) || proposal.currency || '$';

  // Helper to format currency values
  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isApproved = proposal.status === 'APPROVED' || proposal.status === 'ACCEPTED';
  const approvedStamp = isApproved ? `
    <div style="position: absolute; top: 25px; right: 280px; border: 3px solid #10b981; color: #10b981; padding: 6px 16px; font-weight: 900; font-size: 18px; text-transform: uppercase; border-radius: 6px; transform: rotate(-10deg); opacity: 0.85; z-index: 50; letter-spacing: 1px;">
      APPROVED
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proposal ${proposal.quoteNumber || ''}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10px;
      line-height: 1.4;
      color: #334155;
      margin: 0;
      padding: 0;
    }
    .header-table {
      width: 100%;
      margin-bottom: 20px;
      border-collapse: collapse;
    }
    .header-table td {
      vertical-align: top;
    }
    .document-title {
      font-size: 24px;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: 1px;
    }
    .document-number {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
    }
    .info-grid {
      display: flex;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 18px;
    }
    .info-box {
      flex: 1;
      padding: 8px 12px;
      border-right: 1px solid #e2e8f0;
    }
    .info-box:last-child {
      border-right: none;
    }
    .info-box label {
      display: block;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 3px;
    }
    .info-box span {
      font-size: 10px;
      font-weight: 600;
      color: #0f172a;
    }
    .address-grid {
      display: flex;
      gap: 16px;
      margin-bottom: 18px;
    }
    .address-box {
      flex: 1;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .address-box label {
      display: block;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0284c7;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    table.items-table th {
      background: #0284c7;
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 8px 10px;
      text-align: left;
    }
    table.items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 9.5px;
    }
    table.items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .bold { font-weight: 700; }
    .summary-table {
      width: 280px;
      margin-left: auto;
      border-collapse: collapse;
    }
    .summary-table td {
      padding: 5px 8px;
      font-size: 10px;
    }
    .grand-total {
      background: #0284c7;
      color: #ffffff;
      font-weight: 800;
      font-size: 12px;
    }
  </style>
</head>
<body>
  ${approvedStamp}
  
  <table class="header-table">
    <tr>
      <td style="width: 50%;">
        ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="max-height:60px; max-width:180px; object-fit:contain;" />` : `<div style="font-size:20px; font-weight:900; color:#0284c7;">${settings.companyName || 'COMPANY'}</div>`}
        <div style="color:#64748b; font-size:9px; margin-top:6px; line-height:1.4;">
          ${settings.address || ''}<br/>
          ${settings.phone ? `Phone: ${settings.phone}` : ''} ${settings.email ? `| Email: ${settings.email}` : ''}<br/>
          ${settings.trn ? `Tax ID / TRN: ${settings.trn}` : ''}
        </div>
      </td>
      <td style="width: 50%; text-align: right;">
        <div class="document-title">BUSINESS PROPOSAL</div>
        <div class="document-number">${proposal.quoteNumber || 'PRP-' + (proposal.id ? proposal.id.slice(0, 8) : '')}</div>
        ${proposal.title ? `<div style="font-size: 11px; font-weight: 600; color: #475569; margin-top: 4px;">${proposal.title}</div>` : ''}
      </td>
    </tr>
  </table>

  <div class="info-grid">
    <div class="info-box">
      <label>Proposal Date</label>
      <span>${new Date(proposal.issueDate || proposal.createdAt).toLocaleDateString('en-GB')}</span>
    </div>
    <div class="info-box">
      <label>Valid Until</label>
      <span>${proposal.expiryDate ? new Date(proposal.expiryDate).toLocaleDateString('en-GB') : '30 Days'}</span>
    </div>
    <div class="info-box">
      <label>Project / Scope</label>
      <span>${proposal.title || 'Enterprise Scope'}</span>
    </div>
    <div class="info-box">
      <label>Prepared By</label>
      <span>${proposal.assignedTo?.user?.name || proposal.assignedTo?.user?.email || 'Operations Team'}</span>
    </div>
    <div class="info-box">
      <label>Proposal Status</label>
      <span style="color: ${isApproved ? '#10b981' : '#0284c7'}; font-weight: 800;">${proposal.status || 'DRAFT'}</span>
    </div>
  </div>

  <div class="address-grid">
    <div class="address-box">
      <label>PROPOSAL PREPARED FOR</label>
      <div class="bold" style="font-size: 12px; color:#0f172a;">${proposal.customer?.company || proposal.customer?.name || 'Valued Client'}</div>
      ${proposal.contact?.fullName ? `<div style="color: #64748b; margin-top:2px;">Attn: ${proposal.contact.fullName}</div>` : ''}
      <div style="margin-top:4px; color:#64748b;">
        ${proposal.customer?.billingStreet || proposal.customer?.address || ''}<br/>
        ${[proposal.customer?.billingCity, proposal.customer?.billingCountry].filter(Boolean).join(', ')}<br/>
        ${proposal.customer?.phone ? `Phone: ${proposal.customer.phone}` : ''} ${proposal.customer?.email ? `| Email: ${proposal.customer.email}` : ''}
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 50%;">Scope Description & Deliverables</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 15%; text-align: right;">Rate (${sym})</th>
        <th style="width: 15%; text-align: right;">Amount (${sym})</th>
      </tr>
    </thead>
    <tbody>
      ${(proposal.items && proposal.items.length > 0) ? proposal.items.map((i, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div class="bold" style="color:#0f172a;">${i.description || i.product?.name || 'Proposal Item'}</div>
            ${i.itemType ? `<div style="font-size: 8px; color: #64748b;">Type: ${i.itemType}</div>` : ''}
          </td>
          <td class="text-center">${i.quantity} ${i.unit || ''}</td>
          <td class="text-right">${fmt(i.price)}</td>
          <td class="text-right bold">${fmt(i.total)}</td>
        </tr>
      `).join('') : `
        <tr>
          <td colspan="5" class="text-center" style="padding: 16px; color: #94a3b8;">
            Proposal scope and commercial terms outlined as agreed.
          </td>
        </tr>
      `}
    </tbody>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <tr>
      <td style="vertical-align: top; width: 60%; padding-right: 20px;">
        ${proposal.notes ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
            <div class="bold" style="font-size: 8.5px; text-transform: uppercase; color: #0284c7; margin-bottom: 4px;">Notes & Scope Highlights</div>
            <div style="font-size: 9px; color: #475569; white-space: pre-line;">${proposal.notes}</div>
          </div>
        ` : ''}
        ${proposal.termsConditions ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
            <div class="bold" style="font-size: 8.5px; text-transform: uppercase; color: #0284c7; margin-bottom: 4px;">Terms & Acceptance</div>
            <div style="font-size: 9px; color: #475569; white-space: pre-line;">${proposal.termsConditions}</div>
          </div>
        ` : ''}
      </td>
      <td style="vertical-align: top; width: 40%;">
        <table class="summary-table">
          <tr>
            <td>Subtotal:</td>
            <td class="text-right bold">${sym} ${fmt(proposal.subtotal)}</td>
          </tr>
          ${Number(proposal.discount || 0) > 0 ? `
            <tr style="color: #ef4444;">
              <td>Discount:</td>
              <td class="text-right bold">-${sym} ${fmt(proposal.discount)}</td>
            </tr>
          ` : ''}
          ${Number(proposal.tax || 0) > 0 ? `
            <tr>
              <td>Tax:</td>
              <td class="text-right bold">+${sym} ${fmt(proposal.tax)}</td>
            </tr>
          ` : ''}
          <tr class="grand-total">
            <td style="padding: 8px;">Total Proposal Value:</td>
            <td class="text-right bold" style="padding: 8px;">${sym} ${fmt(proposal.totalAmount)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="margin-top: 40px; display: flex; justify-content: space-between;">
    <div style="width: 40%; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 6px;">
      <div style="font-size: 9px; font-weight: 700; color: #0f172a;">Authorized Signature</div>
      <div style="font-size: 8px; color: #64748b;">${settings.companyName || 'Service Provider'}</div>
    </div>
    <div style="width: 40%; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 6px;">
      <div style="font-size: 9px; font-weight: 700; color: #0f172a;">Client Acceptance</div>
      <div style="font-size: 8px; color: #64748b;">${proposal.customer?.company || proposal.customer?.name || 'Client'}</div>
    </div>
  </div>
</body>
</html>
`;
};

