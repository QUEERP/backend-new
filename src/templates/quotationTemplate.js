module.exports = (quotation, settings = {}) => {
  const template = settings.quotationTemplate || quotation.designTemplate || "modern";

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
  const sym = getSymbol(quotation.currency) || quotation.currency || '$';

  // Helper to format currency values
  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Determine dynamic headers based on item types
  const hasGoods = (quotation.items || []).some(i => i.itemType === 'GOODS');
  const hasServices = (quotation.items || []).some(i => i.itemType === 'SERVICE');

  let qtyHeader = "QTY";
  if (hasGoods && !hasServices) {
    qtyHeader = "QTY";
    if (quotation.items && quotation.items.length > 0) {
      const firstUnit = (quotation.items[0].unit || "").toLowerCase();
      if (['kg', 'gram', 'meter', 'litre'].includes(firstUnit)) {
        qtyHeader = quotation.items[0].unit.toUpperCase();
      }
    }
  } else if (!hasGoods && hasServices) {
    qtyHeader = "HRS";
  }

  // Collect unique taxes across items
  const taxSummary = {};
  const itemizedTaxes = [];

  (quotation.items || []).forEach((item, idx) => {
    let taxes = [];
    try {
      taxes = typeof item.taxDetails === 'string' ? JSON.parse(item.taxDetails) : (item.taxDetails || []);
    } catch (e) {
      taxes = [];
    }
    if (!Array.isArray(taxes)) taxes = [];

    const itemPrice = Number(item.price || item.rate || 0);
    const itemQty = Number(item.quantity || item.hours || 0);
    const baseAmount = itemQty * itemPrice;

    if (taxes.length === 0) {
      if (Number(item.taxPercent || 0) > 0) {
        taxes.push({
          name: quotation.vatType || 'Tax',
          rate: item.taxPercent,
          amount: (baseAmount * item.taxPercent) / 100,
        });
      } else if (Number(item.cgstPercent || 0) > 0 || Number(item.sgstPercent || 0) > 0 || Number(item.igstPercent || 0) > 0) {
        if (Number(item.cgstPercent || 0) > 0) taxes.push({ name: 'CGST', rate: item.cgstPercent, amount: (baseAmount * item.cgstPercent) / 100 });
        if (Number(item.sgstPercent || 0) > 0) taxes.push({ name: 'SGST', rate: item.sgstPercent, amount: (baseAmount * item.sgstPercent) / 100 });
        if (Number(item.igstPercent || 0) > 0) taxes.push({ name: 'IGST', rate: item.igstPercent, amount: (baseAmount * item.igstPercent) / 100 });
      }
    }

    item.processedTaxes = taxes;
    const itemTotalTax = taxes.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    item.calculatedTax = itemTotalTax;

    taxes.forEach((t) => {
      if (!taxSummary[t.name]) taxSummary[t.name] = 0;
      taxSummary[t.name] += Number(t.amount || 0);
    });

    if (taxes.length > 0) {
      itemizedTaxes.push({
        index: idx + 1,
        description: item.itemName ? `${item.itemName} - ${item.description || ''}` : (item.description || 'Item'),
        taxes: taxes.map(t => ({
          name: t.name,
          rate: t.rate,
          amount: t.amount,
          base: baseAmount,
        })),
      });
    }
  });

  const hasTax = Number(quotation.tax || 0) > 0 || Object.keys(taxSummary).length > 0;

  const taxBreakdownHtml = hasTax ? `
    <div style="background:#f8f9fa; border:1px solid #eee; padding:10px; font-size: 9px; margin-bottom: 15px; border-radius: 4px;">
      <div style="font-weight:bold; color:#1f4e79; border-bottom:1px solid #ddd; padding-bottom:5px; margin-bottom:8px; text-transform:uppercase;">Tax Breakdown</div>
      ${Object.entries(taxSummary).map(([name, amt]) => `
        <div style="margin-bottom:3px; display:flex; justify-content:space-between;">
          <span>${name}:</span>
          <strong>${sym} ${fmt(amt)}</strong>
        </div>
      `).join('')}
      ${itemizedTaxes.length > 0 ? `
        <div style="margin-top:8px; font-weight:bold; border-top:1px solid #ddd; padding-top:5px; color:#555;">ITEMIZED TAX:</div>
        ${itemizedTaxes.map(item => `
          <div style="margin-top:4px; font-size:8px; border-bottom:1px dashed #eee; padding-bottom:2px;">
            <strong>#${item.index} ${item.description}:</strong><br/>
            ${item.taxes.map(t => `• ${t.name} (${t.rate}%): ${sym} ${fmt(t.amount)}`).join('<br/>')}
          </div>
        `).join('')}
      ` : ''}
    </div>
  ` : '';

  const bankDetailsHtml = (settings.bankName || settings.iban || settings.accountNumber) ? `
    <div style="background:#f8f9fa; border:1px solid #eee; padding:12px; margin-bottom:15px; border-radius: 4px;">
      <div style="color:#1f4e79; font-weight:bold; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:8px; text-transform:uppercase; font-size: 10px;">Payment / Bank Details</div>
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:10px; font-size: 9px;">
        <div>
          <strong>Bank Name:</strong> ${settings.bankName || '-'}<br/>
          <strong>Account Name:</strong> ${settings.accountName || settings.companyName || '-'}
        </div>
        <div>
          <strong>IBAN / Acc #:</strong> ${settings.iban || settings.accountNumber || '-'}<br/>
          <strong>Swift / Branch:</strong> ${settings.swiftCode || settings.branch || '-'}
        </div>
      </div>
    </div>
  ` : '';

  const isApproved = quotation.status === 'APPROVED' || quotation.status === 'ACCEPTED';
  const approvedStamp = isApproved ? `
    <div style="position: absolute; top: 25px; right: 280px; border: 3px solid #10b981; color: #10b981; padding: 6px 16px; font-weight: 900; font-size: 18px; text-transform: uppercase; border-radius: 6px; transform: rotate(-10deg); opacity: 0.85; z-index: 50; letter-spacing: 1px;">
      APPROVED
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 0; }
  *{ box-sizing:border-box; -webkit-print-color-adjust: exact; }
  html, body { height: 100%; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
    font-size: 10px;
    color: #222;
    background: #fff;
    width: 794px;
    min-height: 1123px;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .page-wrapper { flex: 1; display: flex; flex-direction: column; width: 100%; }
  .content-padding { padding: 32px 36px; flex: 1; display: flex; flex-direction: column; }
  
  table { width:100%; border-collapse:collapse; margin-bottom:15px; }
  th { padding:8px 10px; background:#1f4e79; color:#fff; border:1px solid #1f4e79; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing: 0.5px; }
  td { padding:8px 10px; border:1px solid #e2e8f0; vertical-align:top; font-size: 9.5px; }
  .text-right { text-align:right; }
  .text-center { text-align:center; }
  .bold { font-weight:bold; }
  
  .document-header {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1.1fr;
    align-items: start;
    border-bottom: 2px solid #1f4e79;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }
  .document-title { color:#1f4e79; font-size:24px; font-weight:900; text-transform: uppercase; letter-spacing: 1px; }
  .document-number { font-weight: bold; font-size: 12px; margin-top: 4px; color: #1f4e79; }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1px;
    background: #cbd5e1;
    border: 1px solid #cbd5e1;
    margin-bottom: 16px;
    border-radius: 4px;
    overflow: hidden;
  }
  .info-box { background:#fff; padding:7px 9px; }
  .info-box label { display:block; color:#64748b; font-weight:bold; margin-bottom:3px; font-size:8.5px; text-transform: uppercase; }
  .info-box span { font-weight: 600; font-size: 9.5px; color: #0f172a; }

  .address-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom:16px; }
  .address-box { background:#fff; border:1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
  .address-box label { background: #f0f7ff; color:#1f4e79; font-weight:bold; display:block; padding:7px 10px; text-transform:uppercase; font-size: 9px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
  .address-content { padding: 9px 10px; font-size: 9.5px; line-height: 1.45; }

  .items-table tr:nth-child(even) td { background-color: #f8fafc; }
  
  .summary-table { width: 100%; border:none; }
  .summary-table td { border: none; border-bottom: 1px solid #e2e8f0; padding: 7px 10px; font-size: 10px; }
  .summary-table .total-row { background:#1f4e79; color:#fff; font-size: 13px; font-weight: bold; }
  .summary-table .total-row td { border: none; color: #fff; padding: 9px 10px; }
  
  .signature-box { text-align: right; margin-top: 25px; }
  .signature-box img { max-width: 140px; max-height: 55px; margin-bottom: 4px; object-fit: contain; object-position: center; }
  .signature-line { border-top: 2px solid #0f172a; display: inline-block; width: 190px; padding-top: 6px; text-align: center; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
</style>
</head>
<body>
${approvedStamp}
<div class="page-wrapper">
  <div class="content-padding">
    
    <!-- Top Corporate Header -->
    <div class="document-header">
      <div>
        ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="max-height:65px; max-width:180px; object-fit:contain; object-position:left;" />` : `<div style="font-size:22px; font-weight:900; color:#1f4e79;">${settings.companyName || 'COMPANY'}</div>`}
      </div>
      <div class="text-center">
        <div class="bold" style="font-size:15px; color:#0f172a;">${settings.companyName || ''}</div>
        <div style="color:#475569; margin-top:3px; font-size:9px; line-height:1.4;">
          ${settings.address || ''}<br/>
          ${settings.phone ? `Tel: ${settings.phone}` : ''} ${settings.email ? `| Email: ${settings.email}` : ''}<br/>
          ${settings.trn ? `<strong>Tax ID / TRN:</strong> ${settings.trn}` : ''}
        </div>
      </div>
      <div class="text-right">
        <div class="document-title">QUOTATION</div>
        <div class="document-number">${quotation.quoteNumber || 'REF: ' + (quotation.id ? quotation.id.slice(0, 8) : '-')}</div>
        ${quotation.title ? `<div style="font-size: 9px; color: #64748b; margin-top: 2px;">${quotation.title}</div>` : ''}
      </div>
    </div>

    <!-- Metadata 5-Column Grid -->
    <div class="info-grid">
      <div class="info-box">
        <label>Quote Date</label>
        <span>${new Date(quotation.issueDate).toLocaleDateString('en-GB')}</span>
      </div>
      <div class="info-box">
        <label>Valid Until</label>
        <span>${quotation.expiryDate ? new Date(quotation.expiryDate).toLocaleDateString('en-GB') : '30 Days'}</span>
      </div>
      <div class="info-box">
        <label>Linked Deal</label>
        <span>${quotation.deal?.name || '—'}</span>
      </div>
      <div class="info-box">
        <label>Prepared By</label>
        <span>${quotation.assignedTo?.user?.name || quotation.assignedTo?.user?.email || 'Sales Team'}</span>
      </div>
      <div class="info-box">
        <label>Status</label>
        <span style="color: ${isApproved ? '#059669' : '#1f4e79'};">${quotation.status || 'DRAFT'}</span>
      </div>
    </div>

    <!-- Addresses Grid -->
    <div class="address-grid">
      <div class="address-box">
        <label>QUOTATION FOR (CUSTOMER)</label>
        <div class="address-content">
          <div class="bold" style="font-size: 11px; color:#0f172a;">${quotation.customer?.company || quotation.customer?.name || 'Customer'}</div>
          ${quotation.customer?.company && quotation.customer?.name ? `<div style="color: #64748b;">Attn: ${quotation.customer.name}</div>` : ''}
          <div style="margin-top:4px; color:#475569;">
            ${quotation.customer?.billingStreet || quotation.customer?.address || ''}<br/>
            ${[quotation.customer?.billingCity, quotation.customer?.billingState, quotation.customer?.billingCountry].filter(Boolean).join(', ')}<br/>
            ${quotation.customer?.phone ? `Phone: ${quotation.customer.phone}` : ''} ${quotation.customer?.email ? `| ${quotation.customer.email}` : ''}<br/>
            ${quotation.customer?.vatNumber || quotation.customer?.taxId ? `<strong>Tax ID / TRN:</strong> ${quotation.customer?.vatNumber || quotation.customer?.taxId}` : ''}
          </div>
        </div>
      </div>
      <div class="address-box">
        <label>CONTACT & DELIVERY DETAILS</label>
        <div class="address-content">
          <div class="bold" style="font-size: 11px; color:#0f172a;">${quotation.contact?.fullName || quotation.customer?.name || 'Primary Contact'}</div>
          ${quotation.contact?.position ? `<div style="color: #64748b;">${quotation.contact.position}</div>` : ''}
          <div style="margin-top:4px; color:#475569;">
            ${quotation.customer?.shippingStreet || quotation.customer?.billingStreet || quotation.customer?.address || ''}<br/>
            ${[quotation.customer?.shippingCity || quotation.customer?.billingCity, quotation.customer?.billingCountry].filter(Boolean).join(', ')}<br/>
            ${quotation.contact?.phone || quotation.customer?.phone ? `Phone: ${quotation.contact?.phone || quotation.customer?.phone}` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Line Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th width="28" class="text-center">#</th>
          <th>ITEM &amp; DESCRIPTION</th>
          <th width="75" class="text-center">HSN/SAC</th>
          <th width="65" class="text-center">${qtyHeader}</th>
          <th width="50" class="text-center">UNIT</th>
          <th width="85" class="text-right">RATE (${sym})</th>
          <th width="70" class="text-center">TAX %</th>
          <th width="80" class="text-right">TAX AMT</th>
          <th width="95" class="text-right">TOTAL (${sym})</th>
        </tr>
      </thead>
      <tbody>
        ${(quotation.items && quotation.items.length > 0) ? quotation.items.map((i, idx) => {
          const itemUnit = i.unit || (i.product?.unit) || (i.itemType === 'SERVICE' ? 'hr' : 'pcs');
          const itemPrice = Number(i.price || i.rate || 0);
          const itemQty = Number(i.quantity || i.hours || 0);
          const taxAmt = i.calculatedTax !== undefined ? i.calculatedTax : ((itemQty * itemPrice * Number(i.taxPercent || 0)) / 100);
          const itemTotal = Number(i.total || (itemQty * itemPrice + taxAmt) || 0);

          return `
          <tr>
            <td class="text-center" style="color:#64748b;">${idx + 1}</td>
            <td>
              <div class="bold" style="color:#0f172a;">${i.itemName || i.product?.name || i.description || 'Item'}</div>
              ${(i.itemName || i.product?.name) && i.description && i.description !== (i.itemName || i.product?.name) ? `<div style="color:#64748b; font-size:8.5px; margin-top:2px;">${i.description}</div>` : ''}
            </td>
            <td class="text-center" style="color:#64748b; font-family: monospace;">${i.hsnSacCode || i.product?.taxCode || '—'}</td>
            <td class="text-center bold">${itemQty}</td>
            <td class="text-center" style="text-transform: uppercase; font-size: 8.5px; color:#475569;">${itemUnit}</td>
            <td class="text-right font-mono">${fmt(itemPrice)}</td>
            <td class="text-center" style="font-size: 8.5px;">${Number(i.taxPercent || 0)}%</td>
            <td class="text-right font-mono" style="color: #64748b;">${fmt(taxAmt)}</td>
            <td class="text-right bold font-mono">${fmt(itemTotal)}</td>
          </tr>
          `;
        }).join('') : `
          <tr>
            <td colspan="9" class="text-center" style="padding: 24px; color: #64748b;">
              No items attached to this quotation.
            </td>
          </tr>
        `}
      </tbody>
    </table>

    <!-- Bottom Section: Terms/Breakdown & Totals -->
    <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap: 32px; margin-top: 10px;">
      <div>
        ${taxBreakdownHtml}
        ${bankDetailsHtml}
        
        ${quotation.notes ? `
          <div style="margin-bottom: 12px; font-size: 9px; color: #475569; line-height: 1.5; background: #fff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px;">
            <strong style="color: #1f4e79; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 4px;">Notes &amp; Remarks:</strong>
            ${quotation.notes.replace(/\\n/g, '<br/>')}
          </div>
        ` : ''}

        ${(quotation.termsConditions || settings.defaultTerms) ? `
          <div style="font-size: 8.5px; color: #64748b; line-height: 1.45; background: #fff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px;">
            <strong style="color: #1f4e79; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 4px;">Terms &amp; Conditions:</strong>
            ${(quotation.termsConditions || settings.defaultTerms || '').replace(/\\n/g, '<br/>')}
          </div>
        ` : ''}
      </div>

      <div>
        <table class="summary-table">
          <tr>
            <td>Subtotal</td>
            <td class="text-right bold">${sym} ${fmt(quotation.subtotal)}</td>
          </tr>
          ${Number(quotation.discount || 0) > 0 ? `
            <tr style="color: #ef4444;">
              <td>Discount</td>
              <td class="text-right bold">-${sym} ${fmt(quotation.discount)}</td>
            </tr>
          ` : ''}
          ${hasTax ? `
            <tr>
              <td>Total Tax</td>
              <td class="text-right bold">+${sym} ${fmt(quotation.tax)}</td>
            </tr>
          ` : ''}
          <tr class="total-row">
            <td style="padding:10px;">TOTAL ESTIMATE</td>
            <td class="text-right" style="padding:10px; font-size: 14px;">${sym} ${fmt(quotation.totalAmount)}</td>
          </tr>
        </table>
        
        <div class="signature-box">
          ${settings.signatureUrl ? `<img src="${settings.signatureUrl}" style="max-height:55px; max-width:140px; object-fit:contain; object-position:center; margin-bottom:4px;" />` : '<div style="height:50px;"></div>'}
          <div class="signature-line">
            Authorized Signature
          </div>
          <div style="font-size: 8px; color: #64748b; margin-top: 3px;">
            For ${settings.companyName || 'Company'}
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
</body>
</html>
  `;
};
