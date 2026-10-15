const prisma = require('../src/config/prisma');
const fs = require('fs');
const path = require('path');
const { roundHalfUp, getCurrencyDecimals } = require('../src/services/currencyFxService');
const { isValidGstRate } = require('../src/services/tax/gstConfig');

async function runReadOnlyAudit() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const businesses = await prisma.business.findMany({
    include: { baseCurrency: true }
  });
  const businessMap = new Map(businesses.map(b => [b.id, b]));

  const anomalies = {
    generatedAt: new Date().toISOString(),
    invoices: [],
    bills: [],
    payments: []
  };

  // 1. Audit Invoices
  const invoices = await prisma.invoice.findMany({
    include: { items: true, customer: true },
    orderBy: { invoiceDate: 'asc' }
  });

  for (const inv of invoices) {
    const biz = businessMap.get(inv.businessId);
    const baseCode = biz?.baseCurrency?.code || biz?.currency || 'INR';
    const baseDecimals = biz?.baseCurrency?.decimals !== undefined ? biz.baseCurrency.decimals : getCurrencyDecimals(baseCode);
    const rate = Number(inv.exchangeRate || 1);
    const expectedBaseAmount = roundHalfUp(inv.grandTotal * rate, baseDecimals);
    const baseDiff = Math.abs((inv.baseCurrencyAmount || 0) - expectedBaseAmount);

    let sumLineTax = 0;
    let hasZeroTaxPctWithTax = false;
    let hasInvalidGstRate = false;
    const docDate = inv.invoiceDate || inv.createdAt;

    for (const item of inv.items) {
      const lineTax = Number(item.totalTax || 0);
      sumLineTax += lineTax;
      const ratePct = Number(item.taxPercent || 0);
      if (ratePct === 0 && lineTax > 0) hasZeroTaxPctWithTax = true;
      if (ratePct > 0 && (biz?.country === 'INDIA' || biz?.countryCode === 'IN')) {
        if (!isValidGstRate(ratePct, docDate)) hasInvalidGstRate = true;
      }
    }

    const headerTax = Number(inv.totalTax || 0);
    const taxDiff = Math.abs(headerTax - sumLineTax);

    const issues = [];
    if (baseDiff > 0.05) issues.push(`baseCurrencyAmount mismatch: stored=${inv.baseCurrencyAmount}, expected=${expectedBaseAmount} (rate=${rate})`);
    if (taxDiff > 0.05) issues.push(`header tax (${headerTax}) != sum of line taxes (${sumLineTax})`);
    if (hasZeroTaxPctWithTax) issues.push(`item has taxPercent 0 but totalTax > 0`);
    if (hasInvalidGstRate) issues.push(`item has invalid statutory GST rate for date`);

    if (issues.length > 0) {
      anomalies.invoices.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        businessId: inv.businessId,
        businessName: biz?.name,
        currency: inv.currency,
        grandTotal: inv.grandTotal,
        issues
      });
    }
  }

  // 2. Audit Bills
  const bills = await prisma.bill.findMany({
    include: { items: true, vendor: true },
    orderBy: { billDate: 'asc' }
  });

  for (const bill of bills) {
    const biz = businessMap.get(bill.businessId);
    const baseCode = biz?.baseCurrency?.code || biz?.currency || 'INR';
    const baseDecimals = biz?.baseCurrency?.decimals !== undefined ? biz.baseCurrency.decimals : getCurrencyDecimals(baseCode);
    const rate = Number(bill.exchangeRate || 1);
    const expectedBaseAmount = roundHalfUp(bill.totalAmount * rate, baseDecimals);
    const baseDiff = Math.abs((bill.baseCurrencyAmount || 0) - expectedBaseAmount);

    let sumLineTotal = bill.items.reduce((s, it) => s + Number(it.total || 0), 0);
    const issues = [];
    if (baseDiff > 0.05) issues.push(`baseCurrencyAmount mismatch: stored=${bill.baseCurrencyAmount}, expected=${expectedBaseAmount}`);
    if (bill.tax === null || bill.tax === undefined) issues.push(`bill tax field is null`);

    if (issues.length > 0) {
      anomalies.bills.push({
        id: bill.id,
        billNumber: bill.billNumber,
        businessId: bill.businessId,
        businessName: biz?.name,
        currency: bill.currency,
        totalAmount: bill.totalAmount,
        issues
      });
    }
  }

  // 3. Audit Payments
  const payments = await prisma.payment.findMany({
    include: {
      business: true,
      invoice: true,
      bill: true,
      paymentAllocations: { include: { invoice: true } }
    }
  });

  for (const p of payments) {
    const biz = p.business;
    const baseCode = biz?.currency || 'INR';
    const baseDecimals = getCurrencyDecimals(baseCode);
    const rate = Number(p.exchangeRate || 1);
    const expectedBaseAmount = roundHalfUp(p.amount * rate, baseDecimals);
    const baseDiff = Math.abs((p.baseCurrencyAmount || 0) - expectedBaseAmount);

    const alloc = p.paymentAllocations[0];
    const linkedDoc = p.invoice || alloc?.invoice || p.bill;
    const docCurrency = linkedDoc?.currency;

    const issues = [];
    if (p.currency === 'AED' && biz?.currency && biz.currency !== 'AED' && !docCurrency) {
      issues.push(`Payment stored as default 'AED' on non-AED business (${biz.currency})`);
    }
    if (docCurrency && p.currency !== docCurrency) {
      issues.push(`Payment currency (${p.currency}) != linked document currency (${docCurrency})`);
    }
    if (baseDiff > 0.05) {
      issues.push(`baseCurrencyAmount mismatch: stored=${p.baseCurrencyAmount}, expected=${expectedBaseAmount}`);
    }

    if (issues.length > 0) {
      anomalies.payments.push({
        id: p.id,
        paymentNumber: p.paymentNumber,
        businessId: p.businessId,
        businessName: biz?.name,
        amount: p.amount,
        currency: p.currency,
        issues
      });
    }
  }

  // Save JSON
  const jsonPath = path.join(reportsDir, 'audit_data_anomalies.json');
  fs.writeFileSync(jsonPath, JSON.stringify(anomalies, null, 2));

  // Save Markdown
  const mdPath = path.join(reportsDir, 'audit_data_anomalies.md');
  let md = `# Read-Only Data Audit Report\n\n`;
  md += `**Generated At**: ${anomalies.generatedAt}\n`;
  md += `**Scope**: Full database inspection across ${businesses.length} businesses\n\n`;

  md += `## Summary of Anomalies\n`;
  md += `- **Invoices with Anomalies**: ${anomalies.invoices.length}\n`;
  md += `- **Bills with Anomalies**: ${anomalies.bills.length}\n`;
  md += `- **Payments with Anomalies**: ${anomalies.payments.length}\n\n`;

  md += `## 1. Invoice Anomalies\n\n`;
  if (anomalies.invoices.length === 0) {
    md += `*No invoice anomalies detected.*\n\n`;
  } else {
    md += `| Document | Business | Grand Total | Issues |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const inv of anomalies.invoices) {
      md += `| \`${inv.invoiceNumber}\` (\`${inv.id.slice(0, 8)}\`) | ${inv.businessName} | ${inv.currency} ${inv.grandTotal} | ${inv.issues.join('; ')} |\n`;
    }
    md += `\n`;
  }

  md += `## 2. Bill Anomalies\n\n`;
  if (anomalies.bills.length === 0) {
    md += `*No bill anomalies detected.*\n\n`;
  } else {
    md += `| Document | Business | Total Amount | Issues |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const b of anomalies.bills) {
      md += `| \`${b.billNumber}\` (\`${b.id.slice(0, 8)}\`) | ${b.businessName} | ${b.currency} ${b.totalAmount} | ${b.issues.join('; ')} |\n`;
    }
    md += `\n`;
  }

  md += `## 3. Payment Anomalies\n\n`;
  if (anomalies.payments.length === 0) {
    md += `*No payment anomalies detected.*\n\n`;
  } else {
    md += `| Document | Business | Amount | Issues |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const p of anomalies.payments) {
      md += `| \`${p.paymentNumber}\` (\`${p.id.slice(0, 8)}\`) | ${p.businessName} | ${p.currency} ${p.amount} | ${p.issues.join('; ')} |\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(mdPath, md);
  console.log(`✓ Read-only audit generated:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  Markdown: ${mdPath}`);
  console.log(`  Invoices flagged: ${anomalies.invoices.length}`);
  console.log(`  Bills flagged: ${anomalies.bills.length}`);
  console.log(`  Payments flagged: ${anomalies.payments.length}`);

  await prisma.$disconnect();
}

runReadOnlyAudit().catch(console.error);
