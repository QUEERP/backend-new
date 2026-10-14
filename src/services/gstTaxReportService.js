const prisma = require("../config/prisma");
const { roundHalfUp, getCurrencyDecimals } = require("./currencyFxService");

/**
 * GST Rate Slabs Configuration (CBIC Date-Aware)
 * 12% and 28% valid only for documents before 2025-09-22.
 * 40% valid on or after 2025-09-22.
 * Standard invariant slabs: 0, 0.1, 0.25, 1.5, 3, 5, 18.
 */
const GST_RATE_CONFIG = Object.freeze({
  TRANSITION_DATE: new Date('2025-09-22T00:00:00.000Z'),
  BASE_RATES: [0, 0.1, 0.25, 1.5, 3, 5, 18],
  PRE_TRANSITION_RATES: [12, 28],
  POST_TRANSITION_RATES: [40]
});

function getValidGstRatesForDate(docDate) {
  const d = docDate ? new Date(docDate) : new Date();
  const validRates = new Set(GST_RATE_CONFIG.BASE_RATES);
  if (d < GST_RATE_CONFIG.TRANSITION_DATE) {
    GST_RATE_CONFIG.PRE_TRANSITION_RATES.forEach(r => validRates.add(r));
  } else {
    GST_RATE_CONFIG.POST_TRANSITION_RATES.forEach(r => validRates.add(r));
  }
  return validRates;
}

const VALID_CATEGORIES = Object.freeze({
  OUTPUT_TAX: 'Output Tax (Sales)',
  INPUT_TAX: 'Input Tax Credit (Purchases)',
  REVERSE_CHARGE: 'Reverse Charge',
  UNDETERMINED: 'Undetermined',
  UNCLASSIFIED: 'Unclassified'
});

// All posted statuses to include (Draft, Pending Approval, Cancelled are strictly excluded)
const POSTED_INVOICE_STATUSES = [
  'PAID',
  'UNPAID',
  'PARTIALLY_PAID',
  'PARTIAL_PAID',
  'SENT',
  'APPROVED',
  'OVERDUE'
];

const POSTED_BILL_STATUSES = [
  'PAID',
  'UNPAID',
  'PARTIALLY_PAID'
];

// Whitelist for purchase return statuses (Requirement 9)
const POSTED_PURCHASE_RETURN_STATUSES = [
  'SHIPPED',
  'COMPLETED'
];

/**
 * Money math utilities using integer paise to avoid IEEE-754 float inaccuracies.
 */
const toPaise = (amount) => Math.round((Number(amount) || 0) * 100);
const fromPaise = (paise) => Number((paise / 100).toFixed(2));

/**
 * Parses date inputs into Indian Standard Time (IST, UTC+05:30) day boundaries.
 * fromDate: YYYY-MM-DD 00:00:00.000 IST
 * toDate:   YYYY-MM-DD 23:59:59.999 IST
 */
function parseIstDateBoundaries(fromDateStr, toDateStr) {
  let gte = undefined;
  let lte = undefined;

  if (fromDateStr) {
    const datePart = typeof fromDateStr === 'string' ? fromDateStr.split('T')[0] : new Date(fromDateStr).toISOString().split('T')[0];
    gte = new Date(`${datePart}T00:00:00.000+05:30`);
  }

  if (toDateStr) {
    const datePart = typeof toDateStr === 'string' ? toDateStr.split('T')[0] : new Date(toDateStr).toISOString().split('T')[0];
    lte = new Date(`${datePart}T23:59:59.999+05:30`);
  }

  return { gte, lte };
}

function normalizeCountry(countryOrCode) {
  if (!countryOrCode) return '';
  const c = countryOrCode.trim().toUpperCase();
  if (c === 'IN' || c === 'IND' || c === 'INDIA') return 'INDIA';
  if (c === 'AE' || c === 'ARE' || c === 'UAE' || c === 'UNITED ARAB EMIRATES') return 'UAE';
  if (c === 'US' || c === 'USA' || c === 'UNITED STATES') return 'USA';
  if (c === 'CA' || c === 'CAN' || c === 'CANADA') return 'CANADA';
  if (c === 'GB' || c === 'GBR' || c === 'UK' || c === 'UNITED KINGDOM') return 'UK';
  return c;
}

/**
 * Derives whether a transaction is Inter-State (IGST) or Intra-State (CGST + SGST)
 * based on Place of Supply rules.
 * Returns:
 * - true: Inter-State
 * - false: Intra-State
 * - 'undetermined': When seller or buyer state is missing
 */
function isInterStateSupply(business, counterparty) {
  const bCountry = normalizeCountry(business?.countryCode || business?.country || 'IN');
  const cCountry = normalizeCountry(counterparty?.countryCode || counterparty?.country || 'IN');

  // Cross-border exports/imports are treated as Inter-State under IGST Act
  if (bCountry !== cCountry && bCountry && cCountry) {
    return true;
  }

  const bState = (business?.state || '').trim().toLowerCase();
  const cState = (counterparty?.state || counterparty?.billingState || counterparty?.shippingState || '').trim().toLowerCase();

  // If either seller or buyer state is missing, state comparison is undetermined
  if (!bState || !cState) {
    return 'undetermined';
  }

  if (bState !== cState) {
    return true; // Inter-state
  }

  return false; // Intra-state
}

/**
 * Generates an ERP-grade GST Tax Summary for a business.
 * - Groups invoice and bill lines by item-level tax rate (no blended rates).
 * - Converts all KPIs and subtotals to Base Currency (INR).
 * - Excludes Quotations, Estimates, Drafts, and Cancelled documents.
 * - Processes Purchase Returns to reduce ITC and purchase turnover.
 * - Includes Zero-rated, Nil-rated, and Exempt invoices in Taxable Sales.
 */
async function generateGstTaxSummary({ businessId, fromDate, toDate }) {
  if (!businessId) {
    throw new Error("businessId is required");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { baseCurrency: true, taxFramework: true }
  });

  if (!business) {
    throw new Error(`Business ${businessId} not found`);
  }

  const baseCode = business.baseCurrency?.code || business.currency || 'INR';
  const isIndia = (business.countryCode === 'IN' || business.country === 'INDIA');

  // Parse date filters using IST day boundaries
  const { gte, lte } = parseIstDateBoundaries(fromDate, toDate);

  // 1. Fetch Posted Invoices (EXCLUDE Draft, Cancelled, Pending Approval)
  const invoiceWhere = {
    businessId,
    isDeleted: false,
    status: { in: POSTED_INVOICE_STATUSES }
  };
  if (gte || lte) {
    invoiceWhere.invoiceDate = {};
    if (gte) invoiceWhere.invoiceDate.gte = gte;
    if (lte) invoiceWhere.invoiceDate.lte = lte;
  }

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: { customer: true, items: true, transactionCurrency: true },
    orderBy: { invoiceDate: 'asc' }
  });

  // 2. Fetch Posted Bills (EXCLUDE Draft, Cancelled; isDeleted: false if supported)
  const billWhere = {
    businessId,
    status: { in: POSTED_BILL_STATUSES }
  };
  if (prisma.bill.fields?.isDeleted) {
    billWhere.isDeleted = false;
  }
  if (gte || lte) {
    billWhere.billDate = {};
    if (gte) billWhere.billDate.gte = gte;
    if (lte) billWhere.billDate.lte = lte;
  }

  let bills = await prisma.bill.findMany({
    where: billWhere,
    include: { vendor: true, items: true, transactionCurrency: true },
    orderBy: { billDate: 'asc' }
  });
  bills = bills.filter(b => b.isDeleted !== true);

  // 3. Fetch Posted Credit Notes (reduce sales / output tax)
  const cnWhere = {
    businessId,
    isDeleted: false,
    status: { in: ['OPEN', 'CLOSED'] }
  };
  if (gte || lte) {
    cnWhere.createdAt = {};
    if (gte) cnWhere.createdAt.gte = gte;
    if (lte) cnWhere.createdAt.lte = lte;
  }

  const creditNotes = await prisma.creditNote.findMany({
    where: cnWhere,
    include: { customer: true, transactionCurrency: true },
    orderBy: { createdAt: 'asc' }
  });

  // 4. Fetch Posted Purchase Returns (reduce purchases / ITC)
  const prWhere = { businessId };
  if (gte || lte) {
    prWhere.createdAt = {};
    if (gte) prWhere.createdAt.gte = gte;
    if (lte) prWhere.createdAt.lte = lte;
  }
  let purchaseReturns = [];
  try {
    purchaseReturns = await prisma.purchaseReturn.findMany({
      where: prWhere,
      include: { vendor: true, transactionCurrency: true },
      orderBy: { createdAt: 'asc' }
    });
    // Whitelist for posted returns (Requirement 9)
    purchaseReturns = purchaseReturns.filter(pr => POSTED_PURCHASE_RETURN_STATUSES.includes(pr.status?.toUpperCase()));
  } catch (err) {
    purchaseReturns = [];
  }

  const taxLines = [];
  const dataQualityWarnings = [];

  // Distinct document taxable turnover maps (in integer paise in BASE CURRENCY)
  // Key: documentId_rateBucket => taxableBasePaise
  const salesDocTaxablePaise = new Map();
  const purchasesDocTaxablePaise = new Map();

  let totalOutputTaxBasePaise = 0;
  let totalInputTaxBasePaise = 0;

  // ----------------------------------------------------
  // Process Posted Invoices (Output Tax & Turnover)
  // ----------------------------------------------------
  for (const inv of invoices) {
    const docNumber = inv.invoiceNumber || inv.id;
    const docDate = inv.invoiceDate || inv.createdAt;
    const ccy = inv.currency || inv.transactionCurrency?.code || baseCode;
    const fxRate = Number(inv.exchangeRate || 1);

    const placeOfSupplyResult = isInterStateSupply(business, inv.customer);
    if (placeOfSupplyResult === 'undetermined') {
      dataQualityWarnings.push({
        code: 'UNDETERMINED_PLACE_OF_SUPPLY',
        documentNumber: docNumber,
        message: `Place of supply is undetermined for invoice ${docNumber}: seller state (${business.state || 'not set'}) or customer state (${inv.customer?.state || 'not set'}) is missing.`
      });
    }

    const validRatesForDoc = getValidGstRatesForDate(docDate);

    const invSubtotal = Number(inv.subtotal || 0);
    const invDiscount = Number(inv.discount || 0);
    const invShipping = Number(inv.shippingCharges || 0);
    // Statutory GST taxable turnover: subtotal - discount + chargeable shipping (Requirement 8)
    const invTaxableTxnTotal = Math.max(0, invSubtotal - invDiscount + invShipping);

    // Group line items by item-level rate (No blended rates)
    const rateBuckets = new Map();

    if (inv.items && inv.items.length > 0) {
      let rawItemsTotal = 0;
      for (const item of inv.items) {
        const itemAmount = Number(item.amount || (Number(item.quantity || item.hours || 0) * Number(item.rate || 0)) || 0);
        let rate = Number(item.taxPercent ?? ((Number(item.cgstPercent || 0) + Number(item.sgstPercent || 0)) || Number(item.igstPercent || 0) || 0));

        // Fallback for historical items where item tax percent was 0 but invoice has header tax
        if (rate === 0 && Number(inv.totalTax || 0) > 0 && Number(inv.subtotal || 0) > 0) {
          rate = Number(((Number(inv.totalTax) / Number(inv.subtotal)) * 100).toFixed(2));
        }

        if (!rateBuckets.has(rate)) {
          rateBuckets.set(rate, { rawItemAmount: 0 });
        }
        rateBuckets.get(rate).rawItemAmount += itemAmount;
        rawItemsTotal += itemAmount;
      }

      // Distribute net taxable turnover (subtotal - discount + shipping) across rate buckets
      for (const [rate, bucket] of rateBuckets) {
        const ratio = rawItemsTotal > 0 ? bucket.rawItemAmount / rawItemsTotal : (1 / rateBuckets.size);
        const taxableTxn = Number((invTaxableTxnTotal * ratio).toFixed(2));
        const taxableBase = Number((taxableTxn * fxRate).toFixed(2));
        bucket.taxableTxn = taxableTxn;
        bucket.taxableBase = taxableBase;
      }
    } else {
      // Document without item relations: use invoice net taxable turnover and header tax
      const invTax = Number(inv.totalTax || 0);
      const rate = invTaxableTxnTotal > 0 && invTax > 0 ? Number(((invTax / invTaxableTxnTotal) * 100).toFixed(2)) : 0;
      const taxableTxn = invTaxableTxnTotal;
      const taxableBase = Number((taxableTxn * fxRate).toFixed(2));
      rateBuckets.set(rate, {
        rawItemAmount: invTaxableTxnTotal,
        taxableTxn,
        taxableBase
      });
    }

    // Process each rate bucket for this document
    for (const [rate, bucket] of rateBuckets) {
      const taxableTxn = bucket.taxableTxn;
      const taxableBase = bucket.taxableBase;
      const taxableBasePaise = toPaise(taxableBase);
      const bucketKey = `${inv.id}_RATE_${rate}`;

      // Sum document taxable value in base currency (once per document per rate bucket)
      if (taxableBasePaise > 0) {
        salesDocTaxablePaise.set(bucketKey, taxableBasePaise);
      }

      if (rate === 0) {
        // Zero-rated, Nil-rated or Exempt invoice
        const isExport = (normalizeCountry(inv.customer?.countryCode || inv.customer?.country) !== 'INDIA' && normalizeCountry(inv.customer?.countryCode || inv.customer?.country) !== '');
        const taxLabel = isExport ? 'Zero Rated (Export)' : 'Nil Rated (0%)';

        taxLines.push({
          id: `${inv.id}_NIL_${rate}`,
          category: VALID_CATEGORIES.OUTPUT_TAX,
          transactionType: 'INVOICE',
          documentId: inv.id,
          documentNumber: docNumber,
          documentDate: docDate,
          partyName: inv.customer?.company || inv.customer?.name || 'Customer',
          transactionCurrency: ccy,
          taxType: taxLabel,
          taxRate: 0,
          taxableAmountTxnCcy: taxableTxn,
          taxableAmountBaseCcy: taxableBase,
          totalTaxTxnCcy: 0,
          totalTaxBaseCcy: 0,
          isInvalidRate: false,
          placeOfSupply: placeOfSupplyResult
        });
        continue;
      }

      // Check validity of rate
      const isInvalid = !validRatesForDoc.has(rate);
      if (isInvalid) {
        dataQualityWarnings.push({
          code: 'INVALID_GST_RATE',
          documentNumber: docNumber,
          taxType: 'GST',
          recordedRate: rate,
          message: `Invoice ${docNumber} specifies a GST rate of ${rate}%. For documents dated ${new Date(docDate).toISOString().slice(0, 10)}, valid statutory GST slabs are [${Array.from(validRatesForDoc).join(', ')}%].`
        });
      }

      const totalTaxTxn = Number(((taxableTxn * rate) / 100).toFixed(2));
      const totalTaxBase = Number(((taxableBase * rate) / 100).toFixed(2));
      const totalTaxBasePaise = toPaise(totalTaxBase);

      if (placeOfSupplyResult === 'undetermined') {
        // Item 6: Do not guess CGST+SGST. Place in "Undetermined" bucket with warning
        totalOutputTaxBasePaise += totalTaxBasePaise;

        taxLines.push({
          id: `${inv.id}_UNDET_${rate}`,
          category: VALID_CATEGORIES.UNDETERMINED,
          transactionType: 'INVOICE',
          documentId: inv.id,
          documentNumber: docNumber,
          documentDate: docDate,
          partyName: inv.customer?.company || inv.customer?.name || 'Customer',
          transactionCurrency: ccy,
          taxType: 'Undetermined (State Missing)',
          taxRate: rate,
          taxableAmountTxnCcy: taxableTxn,
          taxableAmountBaseCcy: taxableBase,
          totalTaxTxnCcy: totalTaxTxn,
          totalTaxBaseCcy: totalTaxBase,
          isInvalidRate: isInvalid,
          placeOfSupply: 'undetermined'
        });
      } else if (placeOfSupplyResult === true) {
        // Inter-State (IGST)
        totalOutputTaxBasePaise += totalTaxBasePaise;

        taxLines.push({
          id: `${inv.id}_IGST_${rate}`,
          category: VALID_CATEGORIES.OUTPUT_TAX,
          transactionType: 'INVOICE',
          documentId: inv.id,
          documentNumber: docNumber,
          documentDate: docDate,
          partyName: inv.customer?.company || inv.customer?.name || 'Customer',
          transactionCurrency: ccy,
          taxType: 'IGST',
          taxRate: rate,
          taxableAmountTxnCcy: taxableTxn,
          taxableAmountBaseCcy: taxableBase,
          totalTaxTxnCcy: totalTaxTxn,
          totalTaxBaseCcy: totalTaxBase,
          isInvalidRate: isInvalid,
          placeOfSupply: true
        });
      } else {
        // Intra-State (CGST + SGST split 50/50)
        const halfRate = Number((rate / 2).toFixed(2));
        const halfTaxTxn = Number((totalTaxTxn / 2).toFixed(2));
        const halfTaxBase = Number((totalTaxBase / 2).toFixed(2));
        const halfTaxBasePaise = toPaise(halfTaxBase);

        totalOutputTaxBasePaise += (halfTaxBasePaise * 2);

        taxLines.push({
          id: `${inv.id}_CGST_${rate}`,
          category: VALID_CATEGORIES.OUTPUT_TAX,
          transactionType: 'INVOICE',
          documentId: inv.id,
          documentNumber: docNumber,
          documentDate: docDate,
          partyName: inv.customer?.company || inv.customer?.name || 'Customer',
          transactionCurrency: ccy,
          taxType: 'CGST',
          taxRate: halfRate,
          taxableAmountTxnCcy: taxableTxn,
          taxableAmountBaseCcy: taxableBase,
          totalTaxTxnCcy: halfTaxTxn,
          totalTaxBaseCcy: halfTaxBase,
          isInvalidRate: isInvalid,
          placeOfSupply: false
        });

        taxLines.push({
          id: `${inv.id}_SGST_${rate}`,
          category: VALID_CATEGORIES.OUTPUT_TAX,
          transactionType: 'INVOICE',
          documentId: inv.id,
          documentNumber: docNumber,
          documentDate: docDate,
          partyName: inv.customer?.company || inv.customer?.name || 'Customer',
          transactionCurrency: ccy,
          taxType: 'SGST',
          taxRate: halfRate,
          taxableAmountTxnCcy: taxableTxn,
          taxableAmountBaseCcy: taxableBase,
          totalTaxTxnCcy: halfTaxTxn,
          totalTaxBaseCcy: halfTaxBase,
          isInvalidRate: isInvalid,
          placeOfSupply: false
        });
      }
    }
  }

  // ----------------------------------------------------
  // Process Posted Credit Notes (Sales / Output Tax Reversal)
  // ----------------------------------------------------
  for (const cn of creditNotes) {
    const docKey = `CN_${cn.id}`;
    const docNumber = cn.creditNumber || cn.id;
    const docDate = cn.createdAt;
    const ccy = cn.currency || baseCode;
    const fxRate = Number(cn.exchangeRate || 1);

    const amount = Number(cn.amount || 0);
    const taxAmt = Number(cn.totalTax || 0);

    const isOverpayment = (cn.reason && cn.reason.toLowerCase().includes('overpayment')) || cn.type === 'BILL' || (!cn.salesReturnId && Number(cn.totalTax || 0) <= 0);
    if (isOverpayment) {
      // Overpayment credit notes represent balance/advance credits, not sales return tax reversals
      continue;
    }

    // Verify whether amount is tax-inclusive:
    let taxable = taxAmt > 0 ? Math.max(0, amount - taxAmt) : amount;
    let tax = taxAmt;

    if (tax <= 0 && cn.salesReturnId && cn.invoiceId) {
      // Check linked invoice to derive rate only for genuine sales returns
      try {
        const linkedInv = await prisma.invoice.findUnique({ where: { id: cn.invoiceId } });
        if (linkedInv && Number(linkedInv.subtotal || 0) > 0 && Number(linkedInv.totalTax || 0) > 0) {
          const invRate = Number(((Number(linkedInv.totalTax) / Number(linkedInv.subtotal)) * 100).toFixed(2));
          // Amount is tax inclusive: extract tax
          taxable = Number((amount / (1 + invRate / 100)).toFixed(2));
          tax = Number((amount - taxable).toFixed(2));
        }
      } catch (err) {
        // ignore
      }
    }

    if (tax > 0) {
      const taxableBase = Number((taxable * fxRate).toFixed(2));
      const taxBase = Number((tax * fxRate).toFixed(2));
      const taxableBasePaise = toPaise(taxableBase);
      const taxBasePaise = toPaise(taxBase);

      totalOutputTaxBasePaise -= taxBasePaise;
      salesDocTaxablePaise.set(docKey, -taxableBasePaise);

      taxLines.push({
        id: `${docKey}_TAX_REV`,
        category: VALID_CATEGORIES.OUTPUT_TAX,
        transactionType: 'CREDIT_NOTE',
        documentId: cn.id,
        documentNumber: docNumber,
        documentDate: docDate,
        partyName: cn.customer?.company || cn.customer?.name || 'Customer',
        transactionCurrency: ccy,
        taxType: 'Tax Reversal (Credit Note)',
        taxRate: taxable > 0 ? Number(((tax / taxable) * 100).toFixed(2)) : 0,
        taxableAmountTxnCcy: -taxable,
        taxableAmountBaseCcy: -taxableBase,
        totalTaxTxnCcy: -tax,
        totalTaxBaseCcy: -taxBase,
        isInvalidRate: false,
        placeOfSupply: 'N/A'
      });
    }
  }

  // ----------------------------------------------------
  // Process Posted Bills (Input Tax Credit)
  // ----------------------------------------------------
  for (const bill of bills) {
    const docKey = `BILL_${bill.id}`;
    const docNumber = bill.billNumber || bill.id;
    const docDate = bill.billDate || bill.createdAt;
    const ccy = bill.currency || bill.transactionCurrency?.code || baseCode;
    const fxRate = Number(bill.exchangeRate || 1);

    const subtotal = Number(bill.subtotal || 0);
    const subtotalBase = Number((subtotal * fxRate).toFixed(2));
    const subtotalBasePaise = toPaise(subtotalBase);

    const taxAmt = Number(bill.tax || 0);
    const taxBase = Number((taxAmt * fxRate).toFixed(2));
    const taxBasePaise = toPaise(taxBase);

    if (taxAmt <= 0) {
      continue;
    }

    if (subtotalBasePaise > 0) {
      purchasesDocTaxablePaise.set(docKey, subtotalBasePaise);
    }

    // Determine tax rate without fake 5% default
    const taxRate = subtotal > 0 ? Number(((taxAmt / subtotal) * 100).toFixed(2)) : 0;
    totalInputTaxBasePaise += taxBasePaise;

    const validRatesForDoc = getValidGstRatesForDate(docDate);
    const isInvalidRate = !validRatesForDoc.has(taxRate);

    // Split bills into CGST/SGST vs IGST if supplier location allows
    const vendorPos = isInterStateSupply(business, bill.vendor);

    if (vendorPos === false) {
      // Intra-state purchase: split into Input CGST and Input SGST
      const halfRate = Number((taxRate / 2).toFixed(2));
      const halfTaxBase = Number((taxBase / 2).toFixed(2));
      const halfTaxTxn = Number((taxAmt / 2).toFixed(2));

      taxLines.push({
        id: `${docKey}_INP_CGST`,
        category: VALID_CATEGORIES.INPUT_TAX,
        transactionType: 'BILL',
        documentId: bill.id,
        documentNumber: docNumber,
        documentDate: docDate,
        partyName: bill.vendor?.name || bill.vendor?.companyName || 'Vendor',
        transactionCurrency: ccy,
        taxType: 'Input CGST',
        taxRate: halfRate,
        taxableAmountTxnCcy: subtotal,
        taxableAmountBaseCcy: subtotalBase,
        totalTaxTxnCcy: halfTaxTxn,
        totalTaxBaseCcy: halfTaxBase,
        isInvalidRate,
        placeOfSupply: false
      });

      taxLines.push({
        id: `${docKey}_INP_SGST`,
        category: VALID_CATEGORIES.INPUT_TAX,
        transactionType: 'BILL',
        documentId: bill.id,
        documentNumber: docNumber,
        documentDate: docDate,
        partyName: bill.vendor?.name || bill.vendor?.companyName || 'Vendor',
        transactionCurrency: ccy,
        taxType: 'Input SGST',
        taxRate: halfRate,
        taxableAmountTxnCcy: subtotal,
        taxableAmountBaseCcy: subtotalBase,
        totalTaxTxnCcy: halfTaxTxn,
        totalTaxBaseCcy: halfTaxBase,
        isInvalidRate,
        placeOfSupply: false
      });
    } else if (vendorPos === true) {
      // Inter-state purchase: Input IGST
      taxLines.push({
        id: `${docKey}_INP_IGST`,
        category: VALID_CATEGORIES.INPUT_TAX,
        transactionType: 'BILL',
        documentId: bill.id,
        documentNumber: docNumber,
        documentDate: docDate,
        partyName: bill.vendor?.name || bill.vendor?.companyName || 'Vendor',
        transactionCurrency: ccy,
        taxType: 'Input IGST',
        taxRate,
        taxableAmountTxnCcy: subtotal,
        taxableAmountBaseCcy: subtotalBase,
        totalTaxTxnCcy: taxAmt,
        totalTaxBaseCcy: taxBase,
        isInvalidRate,
        placeOfSupply: true
      });
    } else {
      // Undetermined vendor POS: generic Input GST
      taxLines.push({
        id: `${docKey}_ITC`,
        category: VALID_CATEGORIES.INPUT_TAX,
        transactionType: 'BILL',
        documentId: bill.id,
        documentNumber: docNumber,
        documentDate: docDate,
        partyName: bill.vendor?.name || bill.vendor?.companyName || 'Vendor',
        transactionCurrency: ccy,
        taxType: isIndia ? 'Input GST' : 'Input VAT',
        taxRate,
        taxableAmountTxnCcy: subtotal,
        taxableAmountBaseCcy: subtotalBase,
        totalTaxTxnCcy: taxAmt,
        totalTaxBaseCcy: taxBase,
        isInvalidRate,
        placeOfSupply: 'undetermined'
      });
    }
  }

  // ----------------------------------------------------
  // Process Posted Purchase Returns (Reduces Purchases & ITC)
  // ----------------------------------------------------
  for (const pr of purchaseReturns) {
    const docKey = `PR_${pr.id}`;
    const docNumber = pr.returnNumber || pr.id;
    const docDate = pr.createdAt;
    const ccy = pr.currency || baseCode;
    const fxRate = Number(pr.exchangeRate || 1);

    const subtotal = Number(pr.subtotal || 0);
    const subtotalBase = Number((subtotal * fxRate).toFixed(2));
    const subtotalBasePaise = toPaise(subtotalBase);

    const taxAmt = Number(pr.tax || 0);
    const taxBase = Number((taxAmt * fxRate).toFixed(2));
    const taxBasePaise = toPaise(taxBase);

    if (taxAmt > 0) {
      totalInputTaxBasePaise -= taxBasePaise;
      purchasesDocTaxablePaise.set(docKey, -subtotalBasePaise);

      taxLines.push({
        id: `${docKey}_ITC_REV`,
        category: VALID_CATEGORIES.INPUT_TAX,
        transactionType: 'PURCHASE_RETURN',
        documentId: pr.id,
        documentNumber: docNumber,
        documentDate: docDate,
        partyName: pr.vendor?.name || pr.vendor?.companyName || 'Vendor',
        transactionCurrency: ccy,
        taxType: 'ITC Reversal (Purchase Return)',
        taxRate: subtotal > 0 ? Number(((taxAmt / subtotal) * 100).toFixed(2)) : 0,
        taxableAmountTxnCcy: -subtotal,
        taxableAmountBaseCcy: -subtotalBase,
        totalTaxTxnCcy: -taxAmt,
        totalTaxBaseCcy: -taxBase,
        isInvalidRate: false,
        placeOfSupply: 'N/A'
      });
    }
  }

  // ----------------------------------------------------
  // Category Enforcement & Unclassified Safety (Never drops lines)
  // ----------------------------------------------------
  const standardCategoryValues = new Set(Object.values(VALID_CATEGORIES));

  for (const line of taxLines) {
    if (!line.category || !standardCategoryValues.has(line.category)) {
      line.category = VALID_CATEGORIES.UNCLASSIFIED;
      dataQualityWarnings.push({
        code: 'UNCLASSIFIED_TAX_LINE',
        documentNumber: line.documentNumber,
        message: `Tax line for document ${line.documentNumber} could not be automatically categorized and has been assigned to 'Unclassified'. It remains included in report totals.`
      });
    }
  }

  // ----------------------------------------------------
  // Calculate Base-Currency Totals & KPIs (All in integer paise)
  // ----------------------------------------------------
  let distinctTaxableSalesBasePaise = 0;
  for (const [, val] of salesDocTaxablePaise) {
    distinctTaxableSalesBasePaise += val;
  }

  let distinctTaxablePurchasesBasePaise = 0;
  for (const [, val] of purchasesDocTaxablePaise) {
    distinctTaxablePurchasesBasePaise += val;
  }

  const netPayableBasePaise = totalOutputTaxBasePaise - totalInputTaxBasePaise;
  const netItcCarryForwardBasePaise = netPayableBasePaise < 0 ? Math.abs(netPayableBasePaise) : 0;

  return {
    success: true,
    baseCurrency: baseCode,
    kpis: {
      outputTax: fromPaise(totalOutputTaxBasePaise),
      inputTax: fromPaise(totalInputTaxBasePaise),
      netPayable: fromPaise(netPayableBasePaise),
      netItcCarryForward: fromPaise(netItcCarryForwardBasePaise),
      netItcReceivable: fromPaise(netItcCarryForwardBasePaise), // Backwards compatibility alias
      taxableSales: fromPaise(distinctTaxableSalesBasePaise),
      taxablePurchases: fromPaise(distinctTaxablePurchasesBasePaise),
      outputTaxPaise: totalOutputTaxBasePaise,
      inputTaxPaise: totalInputTaxBasePaise,
      netPayablePaise: netPayableBasePaise,
      netItcCarryForwardPaise: netItcCarryForwardBasePaise,
      netItcReceivablePaise: netItcCarryForwardBasePaise,
      taxableSalesPaise: distinctTaxableSalesBasePaise,
      taxablePurchasesPaise: distinctTaxablePurchasesBasePaise
    },
    summary: taxLines,
    dataQualityWarnings
  };
}

module.exports = {
  generateGstTaxSummary,
  GST_RATE_CONFIG,
  getValidGstRatesForDate,
  VALID_CATEGORIES,
  POSTED_INVOICE_STATUSES,
  POSTED_BILL_STATUSES,
  POSTED_PURCHASE_RETURN_STATUSES,
  toPaise,
  fromPaise,
  isInterStateSupply,
  parseIstDateBoundaries
};
