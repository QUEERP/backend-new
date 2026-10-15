const prisma = require('../src/config/prisma');
const { roundHalfUp, getCurrencyDecimals } = require('../src/services/currencyFxService');
const { isValidGstRate } = require('../src/services/tax/gstConfig');
const { determineSupplyType } = require('../src/services/tax/supplyTypeEngine');

async function main() {
  const isExecute = process.argv.includes('--execute');
  const targetAll = process.argv.includes('--all');
  const bIdIndex = process.argv.indexOf('--businessId');
  // Default to 'testing' business ID if not specified
  const DEFAULT_TESTING_BUSINESS_ID = 'dc70ca38-b141-477d-a379-f02649117a78';
  const targetBusinessId = bIdIndex !== -1 && process.argv[bIdIndex + 1] 
    ? process.argv[bIdIndex + 1] 
    : (targetAll ? null : DEFAULT_TESTING_BUSINESS_ID);

  console.log(`\n======================================================`);
  console.log(` DOCUMENT AUDIT & REPAIR SCRIPT`);
  console.log(` Mode:  ${isExecute ? '*** LIVE EXECUTION ***' : 'READ-ONLY (DRY RUN)'}`);
  console.log(` Scope: ${targetBusinessId ? `Single Business (${targetBusinessId})` : 'ALL BUSINESSES (--all)'}`);
  console.log(`======================================================\n`);

  // Fetch businesses
  const businesses = await prisma.business.findMany({
    include: { baseCurrency: true }
  });
  const businessMap = new Map(businesses.map(b => [b.id, b]));

  let invoiceAnomalies = 0;
  let billAnomalies = 0;
  let creditNoteAnomalies = 0;
  let paymentAnomalies = 0;

  // 1. INVOICES
  console.log('--- 1. AUDITING INVOICES ---');
  const invoiceWhere = targetBusinessId ? { businessId: targetBusinessId } : {};
  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: {
      items: true,
      customer: true
    },
    orderBy: { invoiceDate: 'asc' }
  });

  for (const inv of invoices) {
    const business = businessMap.get(inv.businessId);
    const baseCode = business?.baseCurrency?.code || business?.currency || 'INR';
    const baseDecimals = business?.baseCurrency?.decimals !== undefined 
      ? business.baseCurrency.decimals 
      : getCurrencyDecimals(baseCode);
    const txnDecimals = getCurrencyDecimals(inv.currency);

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
      if (ratePct === 0 && lineTax > 0) {
        hasZeroTaxPctWithTax = true;
      }
      if (ratePct > 0 && (business?.countryCode === 'IN' || business?.country === 'INDIA')) {
        if (!isValidGstRate(ratePct, docDate)) {
          hasInvalidGstRate = true;
        }
      }
    }

    const headerTax = Number(inv.totalTax || 0);
    const taxDiff = Math.abs(headerTax - sumLineTax);

    const issues = [];
    if (baseDiff > 0.05) issues.push(`baseCurrencyAmount mismatch: stored=${inv.baseCurrencyAmount}, expected=${expectedBaseAmount}`);
    if (taxDiff > 0.05) issues.push(`header tax (${headerTax}) != sum of line taxes (${sumLineTax})`);
    if (hasZeroTaxPctWithTax) issues.push(`line item has taxPercent 0 but totalTax > 0`);
    if (hasInvalidGstRate) issues.push(`line item has invalid GST rate for doc date`);

    if (issues.length > 0) {
      invoiceAnomalies++;
      console.log(`[ANOMALY] Invoice ${inv.invoiceNumber} (${inv.id}):\n  - ${issues.join('\n  - ')}`);

      if (isExecute) {
        // Fix invoice items
        const supplyRes = determineSupplyType(business, inv.customer);
        let recomputedSubtotal = 0;
        let recomputedCgst = 0;
        let recomputedSgst = 0;
        let recomputedIgst = 0;
        let recomputedTotalTax = 0;

        for (const item of inv.items) {
          const qty = Number(item.quantity || item.hours || 0);
          const prc = Number(item.rate || 0);
          const dsc = Number(item.discount || 0);
          const taxable = Math.max((qty * prc) - dsc, 0);

          let taxPct = Number(item.taxPercent || 0);
          let cgstPct = Number(item.cgstPercent || 0);
          let sgstPct = Number(item.sgstPercent || 0);
          let igstPct = Number(item.igstPercent || 0);

          // If rate was 0 but item had tax or header had tax, derive it
          if (taxPct === 0) {
            if (item.totalTax > 0 && taxable > 0) {
              taxPct = Number(((item.totalTax / taxable) * 100).toFixed(2));
            } else if (headerTax > 0 && inv.subtotal > 0) {
              taxPct = Number(((headerTax / inv.subtotal) * 100).toFixed(2));
            }
          }

          if (supplyRes.isExport) {
            cgstPct = 0;
            sgstPct = 0;
            igstPct = (inv.igst && inv.igst > 0) ? taxPct : 0;
          } else if (supplyRes.isIntraState) {
            cgstPct = Number((taxPct / 2).toFixed(2));
            sgstPct = Number((taxPct / 2).toFixed(2));
            igstPct = 0;
          } else if (supplyRes.isInterState) {
            igstPct = taxPct;
            cgstPct = 0;
            sgstPct = 0;
          }

          const lineCgst = roundHalfUp(taxable * (cgstPct / 100), txnDecimals);
          const lineSgst = roundHalfUp(taxable * (sgstPct / 100), txnDecimals);
          const lineIgst = roundHalfUp(taxable * (igstPct / 100), txnDecimals);
          const itemTax = (lineCgst + lineSgst + lineIgst) > 0 ? (lineCgst + lineSgst + lineIgst) : roundHalfUp(taxable * (taxPct / 100), txnDecimals);
          const lineTotal = roundHalfUp(taxable + itemTax, txnDecimals);

          recomputedSubtotal += taxable;
          recomputedCgst += lineCgst;
          recomputedSgst += lineSgst;
          recomputedIgst += lineIgst;
          recomputedTotalTax += itemTax;

          await prisma.invoiceItem.update({
            where: { id: item.id },
            data: {
              amount: taxable,
              taxPercent: taxPct,
              cgstPercent: cgstPct,
              sgstPercent: sgstPct,
              igstPercent: igstPct,
              totalTax: itemTax,
              totalAmount: lineTotal
            }
          });
        }

        const fixedSubtotal = roundHalfUp(recomputedSubtotal, txnDecimals);
        const fixedTotalTax = roundHalfUp(recomputedTotalTax, txnDecimals);
        const fixedGrandTotal = roundHalfUp(
          fixedSubtotal + fixedTotalTax + Number(inv.shippingCharges || 0) - Number(inv.discount || 0) - Number(inv.tds || 0),
          txnDecimals
        );
        const fixedBaseAmount = roundHalfUp(fixedGrandTotal * rate, baseDecimals);

        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            subtotal: fixedSubtotal,
            cgst: roundHalfUp(recomputedCgst, txnDecimals),
            sgst: roundHalfUp(recomputedSgst, txnDecimals),
            igst: roundHalfUp(recomputedIgst, txnDecimals),
            totalTax: fixedTotalTax,
            grandTotal: fixedGrandTotal,
            baseCurrencyAmount: fixedBaseAmount,
            statutoryBaseAmount: fixedBaseAmount
          }
        });
        console.log(`  -> Repaired Invoice ${inv.invoiceNumber}`);
      }
    }
  }

  // 2. BILLS
  console.log('\n--- 2. AUDITING BILLS ---');
  const billWhere = targetBusinessId ? { businessId: targetBusinessId } : {};
  const bills = await prisma.bill.findMany({
    where: billWhere,
    include: { items: true, vendor: true }
  });

  for (const bill of bills) {
    const business = businessMap.get(bill.businessId);
    const baseCode = business?.baseCurrency?.code || business?.currency || 'INR';
    const baseDecimals = business?.baseCurrency?.decimals !== undefined 
      ? business.baseCurrency.decimals 
      : getCurrencyDecimals(baseCode);

    const rate = Number(bill.exchangeRate || 1);
    const expectedBaseAmount = roundHalfUp(bill.totalAmount * rate, baseDecimals);
    const baseDiff = Math.abs((bill.baseCurrencyAmount || 0) - expectedBaseAmount);

    if (baseDiff > 0.05) {
      billAnomalies++;
      console.log(`[ANOMALY] Bill ${bill.billNumber} (${bill.id}): stored baseCurrencyAmount=${bill.baseCurrencyAmount}, expected=${expectedBaseAmount}`);

      if (isExecute) {
        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            baseCurrencyAmount: expectedBaseAmount,
            statutoryBaseAmount: expectedBaseAmount
          }
        });
        console.log(`  -> Repaired Bill ${bill.billNumber}`);
      }
    }
  }

  // 3. CREDIT NOTES
  console.log('\n--- 3. AUDITING CREDIT NOTES ---');
  const cnWhere = targetBusinessId ? { businessId: targetBusinessId } : {};
  const creditNotes = await prisma.creditNote.findMany({
    where: cnWhere
  });

  for (const cn of creditNotes) {
    const business = businessMap.get(cn.businessId);
    const baseCode = business?.baseCurrency?.code || business?.currency || 'INR';
    const baseDecimals = business?.baseCurrency?.decimals !== undefined 
      ? business.baseCurrency.decimals 
      : getCurrencyDecimals(baseCode);

    const rate = Number(cn.exchangeRate || 1);
    const expectedBaseAmount = roundHalfUp(cn.amount * rate, baseDecimals);
    const baseDiff = Math.abs((cn.baseCurrencyAmount || 0) - expectedBaseAmount);

    if (baseDiff > 0.05) {
      creditNoteAnomalies++;
      console.log(`[ANOMALY] Credit Note ${cn.creditNumber} (${cn.id}): stored baseCurrencyAmount=${cn.baseCurrencyAmount}, expected=${expectedBaseAmount}`);

      if (isExecute) {
        await prisma.creditNote.update({
          where: { id: cn.id },
          data: {
            baseCurrencyAmount: expectedBaseAmount,
            statutoryBaseAmount: expectedBaseAmount
          }
        });
        console.log(`  -> Repaired Credit Note ${cn.creditNumber}`);
      }
    }
  }

  // 4. PAYMENTS
  console.log('\n--- 4. AUDITING PAYMENTS ---');
  const paymentWhere = targetBusinessId ? { businessId: targetBusinessId } : {};
  const payments = await prisma.payment.findMany({
    where: paymentWhere
  });

  for (const p of payments) {
    const business = businessMap.get(p.businessId);
    const baseCode = business?.baseCurrency?.code || business?.currency || 'INR';
    const baseDecimals = business?.baseCurrency?.decimals !== undefined 
      ? business.baseCurrency.decimals 
      : getCurrencyDecimals(baseCode);

    const rate = Number(p.exchangeRate || 1);
    const expectedBaseAmount = roundHalfUp(p.amount * rate, baseDecimals);
    const baseDiff = Math.abs((p.baseCurrencyAmount || 0) - expectedBaseAmount);

    const isCurrencyMissing = !p.currency;
    const isRateMissing = p.exchangeRate === null || p.exchangeRate === undefined;

    if (baseDiff > 0.05 || isCurrencyMissing || isRateMissing) {
      paymentAnomalies++;
      console.log(`[ANOMALY] Payment ${p.paymentNumber} (${p.id}): stored base=${p.baseCurrencyAmount}, expected=${expectedBaseAmount}, currency=${p.currency}, rate=${p.exchangeRate}`);

      if (isExecute) {
        await prisma.payment.update({
          where: { id: p.id },
          data: {
            currency: p.currency || baseCode,
            exchangeRate: rate,
            baseCurrencyAmount: expectedBaseAmount,
            statutoryExchangeRate: rate,
            statutoryBaseAmount: expectedBaseAmount
          }
        });
        console.log(`  -> Repaired Payment ${p.paymentNumber}`);
      }
    }
  }

  console.log('\n======================================================');
  console.log(' AUDIT SUMMARY');
  console.log(` - Invoices with anomalies:     ${invoiceAnomalies}`);
  console.log(` - Bills with anomalies:        ${billAnomalies}`);
  console.log(` - Credit Notes with anomalies: ${creditNoteAnomalies}`);
  console.log(` - Payments with anomalies:     ${paymentAnomalies}`);
  console.log('======================================================\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
