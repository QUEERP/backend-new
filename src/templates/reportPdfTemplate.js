/**
 * Executive Report PDF Template matching the QueErp Invoice and Purchase Order styling.
 * Supports branded corporate header, KPI cards, styled data tables, totals, and signature footer.
 */

function formatNumber(val, decimals = 2) {
  const num = Number(val);
  if (isNaN(num)) return val || '-';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

module.exports = function reportPdfTemplate({
  title = "Statutory & Financial Report",
  subtitle = "Consolidated Transaction Ledger & Audit Report",
  business = {},
  settings = {},
  period = "All Historic Records",
  kpis = [],
  headers = [],
  colWidths = [],
  dataRows = [],
  totals = null,
  currencySymbol = "₹",
  baseCurrency = "INR"
}) {
  const companyName = settings.companyName || business.legalName || business.name || "QueErp Business";
  const address = settings.address || [business.city, business.state, business.country].filter(Boolean).join(', ') || "";
  const phone = settings.phone || "";
  const email = settings.email || "";
  const taxId = settings.trn || settings.vatNumber || business.gstNumber || business.vatNumber || "";
  const logoUrl = settings.companyLogo || null;
  const signatureUrl = settings.signatureUrl || null;
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const docRef = `REP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Determine column alignment and formatting based on header title
  const getColAlign = (header) => {
    const h = (header || '').toLowerCase();
    if (h.includes('amount') || h.includes('rate') || h.includes('val') || h.includes('turnover') || h.includes('total') || h.includes('tax')) {
      return 'right';
    }
    if (h.includes('currency') || h.includes('ccy') || h.includes('code') || h.includes('status')) {
      return 'center';
    }
    return 'left';
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5px;
      line-height: 1.4;
    }

    /* ── HEADER ─────────────────────────────────────────────── */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 2px solid #1f4e79;
      margin-bottom: 12px;
    }
    .brand-col {
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 45%;
    }
    .logo-container {
      max-height: 52px;
      max-width: 140px;
      display: flex;
      align-items: center;
    }
    .logo-img {
      max-height: 52px;
      max-width: 140px;
      object-fit: contain;
    }
    .monogram-badge {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: linear-gradient(135deg, #1f4e79 0%, #0d2847 100%);
      color: #ffffff;
      font-size: 20px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .company-details h1 {
      margin: 0 0 2px 0;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .company-details p {
      margin: 0;
      font-size: 9px;
      color: #475569;
      line-height: 1.35;
    }
    .tax-badge {
      display: inline-block;
      margin-top: 3px;
      font-size: 8.5px;
      font-weight: 700;
      color: #1f4e79;
      background: #e0f2fe;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #bae6fd;
    }

    .title-col {
      text-align: right;
    }
    .title-badge {
      display: inline-block;
      background: #1f4e79;
      color: #ffffff;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 6px;
      margin-bottom: 5px;
      box-shadow: 0 2px 4px rgba(31, 78, 121, 0.2);
    }
    .doc-meta {
      font-size: 9px;
      color: #64748b;
      line-height: 1.4;
    }
    .doc-meta strong {
      color: #1e293b;
    }

    /* ── METADATA BAR ────────────────────────────────────────── */
    .metadata-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 12px;
      margin-bottom: 12px;
      font-size: 9px;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 8px;
      letter-spacing: 0.4px;
    }
    .meta-val {
      color: #0f172a;
      font-weight: 700;
    }
    .pill-badge {
      background: #1f4e79;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
    }

    /* ── KPI CARDS GRID ──────────────────────────────────────── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(${kpis.length > 0 ? Math.min(kpis.length, 4) : 4}, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-top: 3px solid #1f4e79;
      border-radius: 6px;
      padding: 8px 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .kpi-card.accent {
      border-top-color: #f97316;
    }
    .kpi-card.emerald {
      border-top-color: #10b981;
    }
    .kpi-title {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
      margin-bottom: 2px;
    }
    .kpi-subtext {
      font-size: 7.5px;
      color: #94a3b8;
    }

    /* ── TABLE STYLING ───────────────────────────────────────── */
    .table-container {
      margin-bottom: 14px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    table.data-table thead th {
      background: #1f4e79;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      border: none;
      white-space: nowrap;
    }
    table.data-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    table.data-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    table.data-table tbody td {
      padding: 6px 8px;
      font-size: 8.5px;
      color: #1e293b;
      vertical-align: middle;
    }
    .doc-type-badge {
      display: inline-block;
      font-size: 7.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .ccy-pill {
      display: inline-block;
      font-size: 7.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      background: #e2e8f0;
      color: #1e293b;
    }

    /* Totals Footer */
    table.data-table tfoot tr td {
      background: #f1f5f9;
      font-weight: 800;
      font-size: 9px;
      color: #0f172a;
      padding: 8px;
      border-top: 2px solid #1f4e79;
      border-bottom: 2px solid #1f4e79;
    }

    /* ── FOOTER & SIGN-OFF ────────────────────────────────────── */
    .report-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .footer-notes {
      max-width: 60%;
      font-size: 8px;
      color: #64748b;
      line-height: 1.45;
    }
    .footer-notes strong {
      color: #1f4e79;
    }
    .signoff-box {
      text-align: center;
      width: 180px;
    }
    .signature-img {
      max-height: 42px;
      max-width: 130px;
      object-fit: contain;
      margin-bottom: 3px;
    }
    .signature-line {
      border-top: 1.5px solid #0f172a;
      padding-top: 4px;
      font-size: 8.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .signature-sub {
      font-size: 7.5px;
      color: #64748b;
    }

    .bottom-branding {
      text-align: center;
      margin-top: 8px;
      font-size: 7.5px;
      color: #94a3b8;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>

  <!-- ── 1. BRANDED HEADER ── -->
  <div class="report-header">
    <div class="brand-col">
      ${logoUrl ? `
        <div class="logo-container">
          <img src="${logoUrl}" alt="${companyName}" class="logo-img" />
        </div>
      ` : `
        <div class="monogram-badge">
          ${(companyName || 'Q').charAt(0).toUpperCase()}
        </div>
      `}
      <div class="company-details">
        <h1>${companyName}</h1>
        ${address ? `<p>${address}</p>` : ''}
        ${phone || email ? `<p>${[phone, email].filter(Boolean).join(' • ')}</p>` : ''}
        ${taxId ? `<div class="tax-badge">Tax ID / TRN: ${taxId}</div>` : ''}
      </div>
    </div>

    <div class="title-col">
      <div class="title-badge">${title}</div>
      <div class="doc-meta">
        <div><strong>Ref:</strong> ${docRef}</div>
        <div><strong>Generated:</strong> ${generatedAt}</div>
        <div><strong>Base Currency:</strong> ${baseCurrency} (${currencySymbol})</div>
      </div>
    </div>
  </div>

  <!-- ── 2. METADATA STRIP ── -->
  <div class="metadata-bar">
    <div class="meta-item">
      <span class="meta-label">Reporting Scope:</span>
      <span class="meta-val">${subtitle}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Target Period:</span>
      <span class="meta-val">${period}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Total Records:</span>
      <span class="pill-badge">${dataRows.length} Records</span>
    </div>
  </div>

  <!-- ── 3. KPI SUMMARY HIGHLIGHTS ── -->
  ${kpis.length > 0 ? `
    <div class="kpi-grid">
      ${kpis.map((kpi, idx) => `
        <div class="kpi-card ${idx === 1 ? 'accent' : (idx === 2 ? 'emerald' : '')}">
          <div class="kpi-title">${kpi.label}</div>
          <div class="kpi-value">${kpi.value}</div>
          ${kpi.subtext ? `<div class="kpi-subtext">${kpi.subtext}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : ''}

  <!-- ── 4. STYLED TRANSACTION DATA TABLE ── -->
  <div class="table-container">
    <table class="data-table">
      <thead>
        <tr>
          ${headers.map((h, i) => `
            <th style="text-align: ${getColAlign(h)}; ${colWidths[i] ? `width: ${colWidths[i]}px;` : ''}">
              ${h}
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        ${dataRows.length === 0 ? `
          <tr>
            <td colspan="${headers.length}" style="text-align: center; padding: 25px; color: #64748b;">
              No matching transaction records found for the selected reporting period.
            </td>
          </tr>
        ` : dataRows.map(row => `
          <tr>
            ${row.map((cell, i) => {
              const align = getColAlign(headers[i]);
              const headerName = (headers[i] || '').toLowerCase();
              let formattedCell = cell ?? '-';

              if (headerName === 'type') {
                return `<td style="text-align: ${align};"><span class="doc-type-badge">${formattedCell}</span></td>`;
              }
              if (headerName.includes('ccy') || headerName.includes('currency')) {
                return `<td style="text-align: ${align};"><span class="ccy-pill">${formattedCell}</span></td>`;
              }
              if (align === 'right' && typeof cell === 'number') {
                formattedCell = formatNumber(cell, headerName.includes('rate') ? 4 : 2);
              }

              return `<td style="text-align: ${align}; font-variant-numeric: tabular-nums;">${formattedCell}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
      ${totals ? `
        <tfoot>
          <tr>
            ${headers.map((h, i) => {
              const align = getColAlign(h);
              const val = totals[h] ?? (i === 0 ? 'Summary Totals' : '');
              return `<td style="text-align: ${align}; font-variant-numeric: tabular-nums;">${val}</td>`;
            }).join('')}
          </tr>
        </tfoot>
      ` : ''}
    </table>
  </div>

  <!-- ── 5. STATUTORY SIGN-OFF & NOTES ── -->
  <div class="report-footer">
    <div class="footer-notes">
      <strong>Statutory Notice & Audit Trail:</strong><br />
      This statutory report is produced directly from the immutable transaction ledger of <strong>${companyName}</strong>. 
      All exchange rates, multi-currency conversions, and tax entries comply with applicable statutory accounting principles.
      <br />
      <em>Report verification ID: ${docRef} • Confidential Financial Record</em>
    </div>

    <div class="signoff-box">
      ${signatureUrl ? `
        <img src="${signatureUrl}" alt="Signature" class="signature-img" />
      ` : `
        <div style="height: 35px;"></div>
      `}
      <div class="signature-line">Authorized Signatory</div>
      <div class="signature-sub">${companyName}</div>
    </div>
  </div>

  <div class="bottom-branding">
    QueErp Financial Management Suite • Official Export Document • Page 1
  </div>

</body>
</html>`;
};
