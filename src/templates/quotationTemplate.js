module.exports = (quotation, settings = {}) => {
  const getSymbol = (curr) => {
    if (curr === 'INR') return '₹';
    if (curr === 'USD') return '$';
    if (curr === 'EUR') return '€';
    if (curr === 'GBP') return '£';
    return curr;
  };
  const sym = getSymbol(quotation.currency) || quotation.currency || '$';
  const fmt = (val) => (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
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
  }
  else if (!hasGoods && hasServices) qtyHeader = "HRS";

  const isApproved = quotation.status === 'APPROVED' || quotation.status === 'ACCEPTED';
  const approvedStamp = isApproved ? `
    <div style="position: absolute; top: 10px; right: 10px; border: 4px solid #10b981; color: #10b981; padding: 10px 20px; font-weight: 900; font-size: 24px; text-transform: uppercase; border-radius: 8px; transform: rotate(-10deg); opacity: 0.8;">
      APPROVED
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 40px; }
  *{ box-sizing:border-box; -webkit-print-color-adjust: exact; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size:12px; color:#333; background:#fff; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
  .title { font-size: 28px; font-weight: 300; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; margin: 0; }
  .meta-data { margin-top: 10px; font-size: 14px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
  .box h3 { font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 5px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
  .box p { margin: 5px 0; font-size: 13px; font-weight: 500; }
  
  table { width:100%; border-collapse:collapse; margin-bottom:30px; margin-top: 20px; }
  th { padding:12px; background:#f8fafc; border-bottom: 2px solid #e2e8f0; text-align:left; font-size:11px; text-transform:uppercase; color: #64748b; }
  td { padding:12px; border-bottom:1px solid #f1f5f9; vertical-align:top; font-size: 13px; }
  .text-right { text-align:right; }
  
  .totals-box { width: 300px; float: right; background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; }
  .totals-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
  .totals-row.grand { font-size: 18px; font-weight: bold; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 10px; }
  
  .signature-area { margin-top: 60px; text-align: right; }
  .signature-line { border-top: 1px solid #94a3b8; width: 200px; display: inline-block; padding-top: 5px; font-size: 10px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  ${approvedStamp}
  <div class="header">
    <div>
      ${settings.companyLogo ? '<img src="' + settings.companyLogo + '" style="max-height:60px; max-width:200px; object-fit:contain; object-position:left; margin-bottom:15px;" />' : ''}
      <div style="font-size: 18px; font-weight: bold;">${settings.companyName || 'Business'}</div>
      <div style="color: #64748b; margin-top: 5px;">Quotation</div>
      <div style="color: #64748b; margin-top: 5px; font-size: 11px;">
        ${settings.address || ''}<br/>
        ${settings.phone || ''} ${settings.email ? ' | ' + settings.email : ''}
      </div>
    </div>
    <div style="text-align: right;">
      <h1 class="title">QUOTATION</h1>
      <div class="meta-data">
        <div><strong>Date:</strong> ${new Date(quotation.issueDate).toLocaleDateString('en-GB')}</div>
        ${quotation.quoteNumber ? '<div><strong>Quotation Ref:</strong> ' + quotation.quoteNumber + '</div>' : ''}
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="box">
      <h3>Quotation Details</h3>
      <p><strong>Title:</strong> ${quotation.title || '-'}</p>
      <p><strong>Status:</strong> ${quotation.status || '-'}</p>
      <p><strong>Valid Until:</strong> ${quotation.expiryDate ? new Date(quotation.expiryDate).toLocaleDateString('en-GB') : '-'}</p>
      <p><strong>Prepared By:</strong> ${quotation.assignedTo?.user?.name || settings.companyName || 'Sales Team'}</p>
    </div>
    <div class="box">
      <h3>Customer</h3>
      <p><strong>Customer:</strong> ${quotation.customer?.company || quotation.customer?.name || 'N/A'}</p>
      <p>${quotation.customer?.billingStreet || quotation.customer?.address || ''}<br/>
         ${quotation.customer?.billingCity || ''} ${quotation.customer?.billingCountry || ''}</p>
    </div>
  </div>

  ${(quotation.items && quotation.items.length > 0) ? `
  <table>
    <thead>
      <tr>
        <th width="40">#</th>
        <th>ITEM & DESCRIPTION</th>
        <th class="text-right">${qtyHeader}</th>
        <th class="text-right">PRICE</th>
        <th class="text-right">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${quotation.items.map((i, idx) => `
      <tr>
        <td style="color:#94a3b8;">${idx + 1}</td>
        <td>
          <div style="font-weight:bold;">${i.itemName || '-'}</div>
          ${i.description ? '<div style="color:#64748b; font-size:11px; margin-top:3px;">' + i.description + '</div>' : ''}
        </td>
        <td class="text-right">${i.quantity || 0}</td>
        <td class="text-right">${fmt(i.price)}</td>
        <td class="text-right" style="font-weight:bold;">${fmt(i.total)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : `
  <div style="margin-top: 40px; padding: 20px; background: #f8fafc; text-align: center; border-radius: 8px; color: #64748b;">
    No line items attached to this quotation.
  </div>
  `}

  <div class="totals-box">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>${sym} ${fmt(quotation.subtotal)}</span>
    </div>
    ${quotation.discount > 0 ? `
    <div class="totals-row" style="color: #ef4444;">
      <span>Discount</span>
      <span>-${sym} ${fmt(quotation.discount)}</span>
    </div>
    ` : ''}
    <div class="totals-row">
      <span>Tax Amount</span>
      <span>${sym} ${fmt(quotation.tax)}</span>
    </div>
    <div class="totals-row grand">
      <span>Total Amount</span>
      <span>${sym} ${fmt(quotation.totalAmount)}</span>
    </div>
  </div>
  
  <div style="clear:both;"></div>

  <div class="signature-area">
    ${settings.signatureUrl ? '<img src="' + settings.signatureUrl + '" style="max-height:60px; max-width:150px; object-fit:contain; object-position:right; margin-bottom:10px;" /><br/>' : '<div style="height:50px;"></div>'}
    <div class="signature-line">Authorized Signature</div>
  </div>

  ${quotation.notes ? `
  <div style="margin-top: 40px;">
    <h3 style="font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 10px;">Notes / Remarks</h3>
    <div style="font-size: 12px; color: #333; line-height: 1.5;">${quotation.notes.replace(/\\n/g, '<br/>')}</div>
  </div>
  ` : ''}

  ${quotation.termsConditions || settings.defaultTerms ? `
  <div style="margin-top: 20px;">
    <h3 style="font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 10px;">Terms & Conditions</h3>
    <div style="font-size: 12px; color: #333; line-height: 1.5;">${(quotation.termsConditions || settings.defaultTerms || '').replace(/\\n/g, '<br/>')}</div>
  </div>
  ` : ''}

</body>
</html>
  `;
};
