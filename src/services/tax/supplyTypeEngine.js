const { roundHalfUp, getCurrencyDecimals } = require('../currencyFxService');
const { 
  isValidGstRate, 
  resolveGstState, 
  resolveGstStateCode, 
  validateGstinPrefix,
  isValidGstinFormat,
  GST_STATES,
  validateLutDetails,
  isValidIcegatePortCode
} = require('./gstConfig');

function normalizeCountry(c) {
  if (!c) return '';
  const val = String(c).trim().toUpperCase();
  if (['IN', 'IND', 'INDIA'].includes(val)) return 'INDIA';
  if (['AE', 'ARE', 'UAE', 'UNITED ARAB EMIRATES'].includes(val)) return 'UAE';
  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(val)) return 'USA';
  if (['GB', 'GBR', 'UK', 'UNITED KINGDOM'].includes(val)) return 'UK';
  if (['CA', 'CAN', 'CANADA'].includes(val)) return 'CANADA';
  if (['AU', 'AUS', 'AUSTRALIA'].includes(val)) return 'AUSTRALIA';
  return val;
}

/**
 * Shared Statutory Supply-Type Determination Engine
 * Used by Invoice Form, Server-Side Validation, SO Conversion, and Tax Reports.
 * 
 * Rules:
 * 1. Statutory Place of Supply (POS) Determination:
 *    - For GOODS (Section 10(1) IGST Act): POS is the location where the movement of goods terminates
 *      for delivery to the recipient (Ship-To state when provided and differing from Bill-To).
 *    - For SERVICES (Section 12(2) IGST Act): POS is the location of the recipient on record (Bill-To state).
 * 2. State Comparison:
 *    - States are strictly compared using statutory 2-digit GST state codes (e.g. Gujarat = '24', Maharashtra = '27').
 * 3. Supply Classifications:
 *    - Same GST State Code                       -> CGST_SGST (Intra-State)
 *    - Different GST State Code                  -> IGST (Inter-State)
 *    - Special Economic Zone (SEZ)               -> SEZ_WITH_IGST / SEZ_WITHOUT_IGST (Section 7(5)(b) IGST Act)
 *    - Foreign Buyer (outside India)             -> EXPORT_LUT / EXPORT_WITH_IGST
 *    - Missing State / Country                   -> UNDETERMINED (never guessed; returns statutory warning)
 */
function determineSupplyType(seller, buyer, shipToArg, docDateArg, isGoodsArg, isSezArg, sezTypeArg, exportTypeArg) {
  // Support both positional arguments and options object
  let shipTo = shipToArg;
  let docDate = docDateArg;
  let isGoods = isGoodsArg !== undefined ? isGoodsArg : true;
  let isSez = isSezArg;
  let sezType = sezTypeArg;
  let exportType = exportTypeArg;

  if (shipToArg && typeof shipToArg === 'object' && !shipToArg.state && !shipToArg.country) {
    // Unpack options object if passed as 3rd parameter
    const opts = shipToArg;
    shipTo = opts.shipTo;
    docDate = opts.docDate;
    if (opts.isGoods !== undefined) isGoods = opts.isGoods;
    if (opts.isSez !== undefined) isSez = opts.isSez;
    if (opts.sezType !== undefined) sezType = opts.sezType;
    if (opts.exportType !== undefined) exportType = opts.exportType;
  }

  const sellerCountry = normalizeCountry(seller?.countryCode || seller?.country || 'INDIA');
  const buyerCountry = normalizeCountry(
    buyer?.billingCountry || buyer?.shippingCountry || buyer?.country || buyer?.region || ''
  );

  // 1. Missing Buyer Country Check
  if (!buyerCountry) {
    return {
      supplyType: 'UNDETERMINED',
      isExport: false,
      isIntraState: false,
      isInterState: false,
      isSez: false,
      label: 'Undetermined (Missing Buyer Country)',
      reason: 'Buyer country is not specified. Statutory Place of Supply cannot be determined.',
      warning: 'Buyer country is missing. Cannot determine statutory tax regime.'
    };
  }

  // 2. India Business (Seller in India)
  if (sellerCountry === 'INDIA') {
    // Validate Seller State and GSTIN
    const sellerStateCode = resolveGstStateCode(seller?.state);
    const sellerGstin = seller?.gstNumber || seller?.gstin;

    if (!sellerStateCode) {
      return {
        supplyType: 'UNDETERMINED',
        isExport: false,
        isIntraState: false,
        isInterState: false,
        isSez: false,
        label: 'Undetermined (Missing Seller State)',
        reason: 'Seller state is missing or unresolvable in statutory GST master. Cannot determine Place of Supply.',
        warning: 'Seller state is missing. Please configure business profile in Settings (/settings/company).'
      };
    }

    if (sellerGstin) {
      const gstinVal = validateGstinPrefix(sellerGstin, sellerStateCode);
      if (!gstinVal.valid) {
        return {
          supplyType: 'UNDETERMINED',
          isExport: false,
          isIntraState: false,
          isInterState: false,
          isSez: false,
          label: 'Undetermined (Invalid Seller GSTIN)',
          reason: gstinVal.error,
          warning: gstinVal.error
        };
      }
    }

    // Check SEZ (Special Economic Zone)
    const buyerIsSez = isSez || buyer?.isSez || buyer?.sez || false;
    if (buyerIsSez) {
      const sezTypeStr = (sezType || buyer?.sezType || '').toUpperCase();
      const isWithPayment = sezTypeStr.includes('WITH_PAYMENT') && !sezTypeStr.includes('WITHOUT');
      const st = isWithPayment ? 'SEZ_WITH_IGST' : 'SEZ_WITHOUT_IGST';
      return {
        supplyType: st,
        isExport: false,
        isIntraState: false,
        isInterState: true,
        isSez: true,
        label: isWithPayment ? 'SEZ (With Payment of IGST)' : 'SEZ (Under LUT / Zero-rated)',
        reason: `SEZ Supply under Section 7(5)(b) IGST Act: Treated as Inter-State Supply (${st}).`,
        applicableTaxes: isWithPayment ? ['IGST'] : ['IGST_ZERO']
      };
    }

    // Export Supply (Buyer outside India)
    if (buyerCountry !== 'INDIA') {
      const expStr = (exportType || '').toUpperCase();
      const isWithPayment = expStr.includes('WITH_PAYMENT') && !expStr.includes('WITHOUT');
      const st = isWithPayment ? 'EXPORT_WITH_IGST' : 'EXPORT_LUT';
      return {
        supplyType: st,
        isExport: true,
        isIntraState: false,
        isInterState: false,
        isSez: false,
        label: isWithPayment ? 'Export (With Payment of IGST)' : 'Export (Under LUT / Zero-rated)',
        reason: `Export of ${isGoods ? 'goods' : 'services'} outside India to ${buyerCountry}. Zero-rated supply under Section 16 IGST Act.`,
        applicableTaxes: isWithPayment ? ['IGST'] : ['IGST_ZERO']
      };
    }

    // Domestic India Supply
    // Statutory POS Rule:
    // - Goods: Ship-To state governs POS when movement terminates at destination (Section 10(1) IGST Act).
    // - Services: Bill-To registered recipient location governs POS (Section 12(2) IGST Act).
    const billToStateInput = buyer?.billingState || buyer?.state;
    const shipToStateInput = (shipTo && typeof shipTo === 'object' ? shipTo.state : shipTo) || buyer?.shippingState;

    const effectivePosStateInput = (isGoods && shipToStateInput) ? shipToStateInput : billToStateInput;
    const buyerStateCode = resolveGstStateCode(effectivePosStateInput);

    if (!buyerStateCode) {
      return {
        supplyType: 'UNDETERMINED',
        isExport: false,
        isIntraState: false,
        isInterState: false,
        isSez: false,
        label: 'Undetermined (Missing Buyer State)',
        reason: `Buyer Place of Supply state (${effectivePosStateInput || 'unspecified'}) cannot be resolved in GST state master.`,
        warning: 'Buyer state is missing or invalid. CBIC regulations require Place of Supply state for GST calculation.'
      };
    }

    // Validate Buyer GSTIN if provided
    const buyerGstin = buyer?.gstNumber || buyer?.gstin || buyer?.vatNumber;
    if (buyerGstin && isValidGstinFormat(buyerGstin)) {
      const buyerGstinVal = validateGstinPrefix(buyerGstin, billToStateInput || buyerStateCode);
      if (!buyerGstinVal.valid) {
        // Log warning but don't hard crash if shipping state differs from registration state
      }
    }

    const sellerStateObj = resolveGstState(sellerStateCode);
    const buyerStateObj = resolveGstState(buyerStateCode);

    if (sellerStateCode === buyerStateCode) {
      return {
        supplyType: 'CGST_SGST',
        isExport: false,
        isIntraState: true,
        isInterState: false,
        isSez: false,
        label: 'Same State (CGST + SGST)',
        sellerStateCode,
        buyerStateCode,
        sellerState: sellerStateObj?.name || sellerStateCode,
        buyerState: buyerStateObj?.name || buyerStateCode,
        posBasis: isGoods && shipToStateInput ? 'Ship-To (Goods Destination)' : 'Bill-To (Recipient Location)',
        reason: `Intra-state supply within ${sellerStateObj?.name || sellerStateCode} (State Code ${sellerStateCode})`,
        applicableTaxes: ['CGST', 'SGST']
      };
    } else {
      return {
        supplyType: 'IGST',
        isExport: false,
        isIntraState: false,
        isInterState: true,
        isSez: false,
        label: 'Different State (IGST)',
        sellerStateCode,
        buyerStateCode,
        sellerState: sellerStateObj?.name || sellerStateCode,
        buyerState: buyerStateObj?.name || buyerStateCode,
        posBasis: isGoods && shipToStateInput ? 'Ship-To (Goods Destination)' : 'Bill-To (Recipient Location)',
        reason: `Inter-state supply from ${sellerStateObj?.name || sellerStateCode} (Code ${sellerStateCode}) to ${buyerStateObj?.name || buyerStateCode} (Code ${buyerStateCode})`,
        applicableTaxes: ['IGST']
      };
    }
  }

  // 3. UAE / GCC / International Businesses
  if (sellerCountry === 'UAE') {
    if (buyerCountry !== 'UAE') {
      return {
        supplyType: 'EXPORT_LUT',
        isExport: true,
        isIntraState: false,
        isInterState: false,
        isSez: false,
        label: 'Export (0% VAT)',
        reason: `Export outside UAE to ${buyerCountry}`,
        applicableTaxes: ['VAT_ZERO']
      };
    }
    return {
      supplyType: 'DOMESTIC_VAT',
      isExport: false,
      isIntraState: true,
      isInterState: false,
      isSez: false,
      label: 'UAE Domestic (5% VAT)',
      reason: 'Domestic supply within UAE',
      applicableTaxes: ['VAT']
    };
  }

  // 4. Other Jurisdictions
  return {
    supplyType: sellerCountry === buyerCountry ? 'DOMESTIC_STANDARD' : 'EXPORT_LUT',
    isExport: sellerCountry !== buyerCountry,
    isIntraState: sellerCountry === buyerCountry,
    isInterState: false,
    isSez: false,
    label: sellerCountry === buyerCountry ? 'Domestic Standard' : 'International Export',
    reason: `Supply from ${sellerCountry} to ${buyerCountry}`,
    applicableTaxes: ['TAX']
  };
}

/**
 * Recomputes invoice line items and header taxes strictly from line items.
 * Validates tax types and rates, rejecting illegal tax applications.
 */
function recomputeInvoiceFinancials({
  business,
  customer,
  items,
  headerData = {},
  baseCurrencyCode = 'INR',
  transactionCurrencyCode = 'INR',
  exchangeRate = 1.0,
  statutoryRate = 1.0
}) {
  const sellerCountry = normalizeCountry(business?.countryCode || business?.country || 'INDIA');
  const isIndia = sellerCountry === 'INDIA';

  // 1. Seller validation for India business
  if (isIndia) {
    const missing = [];
    if (!business?.state || !String(business.state).trim()) missing.push('State');
    if (!business?.gstNumber || !String(business.gstNumber).trim()) missing.push('GSTIN');
    if (missing.length > 0) {
      throw new Error(
        `Cannot create or update invoice: Registered business ${missing.join(' and ')} is missing. ` +
        `Under CBIC regulations for Indian businesses, seller State and GSTIN are required to determine statutory Place of Supply. ` +
        `Please configure your business profile in Business Settings (/settings/company).`
      );
    }
  }

  const rawItems = Array.isArray(items) ? items : [];
  if (rawItems.length === 0) {
    throw new Error('Invoice must have at least one line item.');
  }

  // Check if invoice items represent goods vs services
  const hasGoods = rawItems.some(it => !it.hours && it.itemType !== 'SERVICE');
  const docDate = headerData.invoiceDate ? new Date(headerData.invoiceDate) : new Date();

  // 2. Supply Type Resolution
  const supplyResolution = determineSupplyType(business, customer, {
    shipTo: headerData.shippingAddress || customer?.shippingAddress,
    docDate,
    isGoods: hasGoods,
    isSez: headerData.isSez || customer?.isSez,
    sezType: headerData.sezType,
    exportType: headerData.exportType
  });

  const txnDecimals = getCurrencyDecimals(transactionCurrencyCode);
  const baseDecimals = getCurrencyDecimals(baseCurrencyCode);

  if (supplyResolution.supplyType === 'UNDETERMINED') {
    throw new Error(`Cannot compute statutory GST: Supply is UNDETERMINED (${supplyResolution.reason}). CBIC mandates seller and buyer state/country to determine Place of Supply.`);
  }

  const isExportSupply = supplyResolution.isExport || supplyResolution.supplyType.startsWith('EXPORT');
  const isSezSupply = supplyResolution.isSez || supplyResolution.supplyType.startsWith('SEZ');
  const exportType = headerData.exportType ? String(headerData.exportType).toUpperCase().trim() : null;

  if (isExportSupply && !exportType) {
    throw new Error('Export invoice creation requires an explicit exportType ("LUT" or "WITH_PAYMENT_OF_IGST").');
  }

  // Statutory Validation for Exports (Rule 96 / 96A)
  if (isExportSupply) {
    if (exportType === 'LUT' || exportType === 'UNDER_LUT') {
      if (headerData.lutNumber || headerData.lutDate) {
        const lutVal = validateLutDetails({
          lutNumber: headerData.lutNumber,
          lutDate: headerData.lutDate,
          invoiceDate: docDate
        });
        if (!lutVal.valid) {
          throw new Error(`Statutory LUT Error: ${lutVal.error}`);
        }
      }
    }
    if (hasGoods) {
      if (headerData.shippingBillDate) {
        const dSb = new Date(headerData.shippingBillDate);
        if (!isNaN(dSb.getTime())) {
          const sbYmd = dSb.toISOString().slice(0, 10);
          const invYmd = docDate.toISOString().slice(0, 10);
          if (sbYmd > invYmd) {
            throw new Error(`Shipping Bill Date (${sbYmd}) cannot be after Invoice Date (${invYmd}).`);
          }
        }
      }
      if (headerData.portCode) {
        if (!isValidIcegatePortCode(headerData.portCode)) {
          throw new Error(`Invalid ICEGATE Port Code "${headerData.portCode}". Must be a valid 6-character port code (e.g. INKDL4, INMUN1).`);
        }
      }
    }
  }

  let lineItemsSubtotal = 0;
  let lineItemsTotalItemDiscount = 0;
  let lineItemsCgst = 0;
  let lineItemsSgst = 0;
  let lineItemsIgst = 0;
  let lineItemsTotalTax = 0;

  const recomputedItems = rawItems.map((item, idx) => {
    const qty = Number(item.quantity !== undefined ? item.quantity : (item.hours || 0));
    const rate = Number(item.rate !== undefined ? item.rate : (item.price || 0));
    const grossAmount = roundHalfUp(qty * rate, txnDecimals);
    const itemDiscount = roundHalfUp(Number(item.discount || 0), txnDecimals);

    // Statutory Taxable Value: Gross minus trade discount
    const taxableAmount = Math.max(roundHalfUp(grossAmount - itemDiscount, txnDecimals), 0);
    lineItemsSubtotal += grossAmount;
    lineItemsTotalItemDiscount += itemDiscount;

    let taxPercent = Number(item.taxPercent || 0);

    // Statutory Rate Verification
    if (taxPercent > 0 && isIndia) {
      if (!isValidGstRate(taxPercent, docDate)) {
        throw new Error(
          `Invalid GST rate (${taxPercent}%) for item "${item.description || idx + 1}". ` +
          `Statutory CBIC rate slabs are 0%, 0.1%, 0.25%, 1.5%, 3%, 5%, 18% (12% and 28% pre-Sept 2025; 40% post-Sept 2025).`
        );
      }
    }

    let itemCgstPercent = 0;
    let itemSgstPercent = 0;
    let itemIgstPercent = 0;
    let itemCgstAmount = 0;
    let itemSgstAmount = 0;
    let itemIgstAmount = 0;
    let itemTotalTax = 0;

    if (supplyResolution.supplyType === 'CGST_SGST' || supplyResolution.supplyType === 'INTRA_STATE') {
      // Intra-state: CGST (50%) + SGST (50%)
      if (Number(item.igstPercent || 0) > 0 || Number(item.igst || 0) > 0) {
        throw new Error(`Statutory Error: IGST cannot be charged on Intra-State supply (${supplyResolution.reason}). Only CGST + SGST apply.`);
      }
      itemCgstPercent = roundHalfUp(taxPercent / 2, 4);
      itemSgstPercent = roundHalfUp(taxPercent / 2, 4);
      itemCgstAmount = roundHalfUp(taxableAmount * (itemCgstPercent / 100), txnDecimals);
      itemSgstAmount = roundHalfUp(taxableAmount * (itemSgstPercent / 100), txnDecimals);
      itemTotalTax = roundHalfUp(itemCgstAmount + itemSgstAmount, txnDecimals);

      lineItemsCgst += itemCgstAmount;
      lineItemsSgst += itemSgstAmount;
    } else if (supplyResolution.supplyType === 'IGST' || supplyResolution.supplyType === 'INTER_STATE') {
      // Inter-state: IGST 100%
      if (Number(item.cgstPercent || 0) > 0 || Number(item.sgstPercent || 0) > 0 ||
          Number(item.cgst || 0) > 0 || Number(item.sgst || 0) > 0) {
        throw new Error(`Statutory Error: CGST/SGST cannot be charged on Inter-State supply (${supplyResolution.reason}). Only IGST applies.`);
      }
      itemIgstPercent = taxPercent;
      itemIgstAmount = roundHalfUp(taxableAmount * (itemIgstPercent / 100), txnDecimals);
      itemTotalTax = itemIgstAmount;

      lineItemsIgst += itemIgstAmount;
    } else if (isExportSupply) {
      // Export Supply
      if (Number(item.cgstPercent || 0) > 0 || Number(item.sgstPercent || 0) > 0 ||
          Number(item.cgst || 0) > 0 || Number(item.sgst || 0) > 0) {
        throw new Error(`Statutory Error: CGST/SGST cannot be charged on foreign export customers. Only Zero-rated LUT or IGST applies.`);
      }

      if (exportType === 'LUT' || exportType === 'UNDER_LUT') {
        if (taxPercent > 0 || Number(item.igst || 0) > 0 || Number(item.igstPercent || 0) > 0 || Number(item.cgstPercent || 0) > 0 || Number(item.sgstPercent || 0) > 0) {
          throw new Error('Statutory Error: Exports under LUT / Bond must be zero-rated (0% IGST). Cannot charge tax.');
        }
        itemIgstPercent = 0;
        itemIgstAmount = 0;
        itemTotalTax = 0;
      } else if (exportType === 'WITH_PAYMENT_OF_IGST') {
        itemIgstPercent = taxPercent;
        itemIgstAmount = roundHalfUp(taxableAmount * (itemIgstPercent / 100), txnDecimals);
        itemTotalTax = itemIgstAmount;
        lineItemsIgst += itemIgstAmount;
      }
    } else if (isSezSupply) {
      if (supplyResolution.supplyType === 'SEZ_WITH_IGST') {
        itemIgstPercent = taxPercent;
        itemIgstAmount = roundHalfUp(taxableAmount * (itemIgstPercent / 100), txnDecimals);
        itemTotalTax = itemIgstAmount;
        lineItemsIgst += itemIgstAmount;
      } else {
        itemIgstPercent = 0;
        itemIgstAmount = 0;
        itemTotalTax = 0;
      }
    } else {
      // Other / General
      itemTotalTax = roundHalfUp(taxableAmount * (taxPercent / 100), txnDecimals);
    }

    lineItemsTotalTax += itemTotalTax;
    const itemTotalAmount = roundHalfUp(taxableAmount + itemTotalTax, txnDecimals);

    return {
      id: item.id,
      description: item.description,
      quantity: qty,
      hours: qty,
      rate,
      amount: grossAmount,
      discount: itemDiscount,
      taxableAmount,
      taxPercent,
      cgstPercent: itemCgstPercent,
      sgstPercent: itemSgstPercent,
      igstPercent: itemIgstPercent,
      cgst: itemCgstAmount,
      sgst: itemSgstAmount,
      igst: itemIgstAmount,
      cgstAmount: itemCgstAmount,
      sgstAmount: itemSgstAmount,
      igstAmount: itemIgstAmount,
      totalTax: itemTotalTax,
      totalAmount: itemTotalAmount
    };
  });

  const headerDiscount = roundHalfUp(Number(headerData.discount || 0), txnDecimals);
  const shippingCharges = roundHalfUp(Number(headerData.shippingCharges || 0), txnDecimals);

  const recomputedSubtotal = roundHalfUp(lineItemsSubtotal, txnDecimals);
  const recomputedCgst = roundHalfUp(lineItemsCgst, txnDecimals);
  const recomputedSgst = roundHalfUp(lineItemsSgst, txnDecimals);
  const recomputedIgst = roundHalfUp(lineItemsIgst, txnDecimals);
  const recomputedTotalTax = roundHalfUp(lineItemsTotalTax, txnDecimals);

  if (isExportSupply && (exportType === 'LUT' || exportType === 'UNDER_LUT')) {
    if (recomputedTotalTax > 0 || recomputedIgst > 0 || recomputedCgst > 0 || recomputedSgst > 0) {
      throw new Error('Statutory Error: Exports under LUT / Bond cannot have tax. Total tax must be 0.');
    }
  }

  // Grand total formula: Subtotal - Item Discounts - Document Discount + Shipping Charges + Recomputed Tax
  const recomputedGrandTotal = roundHalfUp(
    Math.max(recomputedSubtotal - lineItemsTotalItemDiscount - headerDiscount, 0) + shippingCharges + recomputedTotalTax,
    txnDecimals
  );

  // Scaled base currency calculations using base currency exponent
  const effectiveExchangeRate = Number(exchangeRate || 1.0);
  const effectiveStatutoryRate = Number(statutoryRate || effectiveExchangeRate);

  const recomputedBaseAmount = roundHalfUp(recomputedGrandTotal * effectiveExchangeRate, baseDecimals);
  const recomputedStatutoryBaseAmount = roundHalfUp(recomputedGrandTotal * effectiveStatutoryRate, baseDecimals);

  // Build TaxTransactions array
  const taxTransactions = [];
  if (recomputedCgst > 0) {
    taxTransactions.push({
      taxType: 'CGST',
      rate: recomputedItems[0]?.cgstPercent || 0,
      taxableAmount: recomputedSubtotal - lineItemsTotalItemDiscount,
      taxAmount: recomputedCgst,
      taxAmountTxnCcy: recomputedCgst,
      taxAmountBaseCcy: roundHalfUp(recomputedCgst * effectiveExchangeRate, baseDecimals)
    });
  }
  if (recomputedSgst > 0) {
    taxTransactions.push({
      taxType: 'SGST',
      rate: recomputedItems[0]?.sgstPercent || 0,
      taxableAmount: recomputedSubtotal - lineItemsTotalItemDiscount,
      taxAmount: recomputedSgst,
      taxAmountTxnCcy: recomputedSgst,
      taxAmountBaseCcy: roundHalfUp(recomputedSgst * effectiveExchangeRate, baseDecimals)
    });
  }
  if (recomputedIgst > 0) {
    taxTransactions.push({
      taxType: 'IGST',
      rate: recomputedItems[0]?.igstPercent || 0,
      taxableAmount: recomputedSubtotal - lineItemsTotalItemDiscount,
      taxAmount: recomputedIgst,
      taxAmountTxnCcy: recomputedIgst,
      taxAmountBaseCcy: roundHalfUp(recomputedIgst * effectiveExchangeRate, baseDecimals)
    });
  }

  return {
    supplyType: supplyResolution.supplyType,
    supplyResolution,
    items: recomputedItems,
    processedItems: recomputedItems,
    subtotal: recomputedSubtotal,
    itemDiscounts: lineItemsTotalItemDiscount,
    discount: headerDiscount,
    shippingCharges,
    taxableTurnover: Math.max(recomputedSubtotal - lineItemsTotalItemDiscount - headerDiscount, 0) + shippingCharges,
    cgst: recomputedCgst,
    sgst: recomputedSgst,
    igst: recomputedIgst,
    totalTax: recomputedTotalTax,
    grandTotal: recomputedGrandTotal,
    exchangeRate: effectiveExchangeRate,
    baseCurrencyAmount: recomputedBaseAmount,
    statutoryExchangeRate: effectiveStatutoryRate,
    statutoryBaseAmount: recomputedStatutoryBaseAmount,
    taxTransactions
  };
}

const SUPPLY_TYPES = {
  CGST_SGST: 'CGST_SGST',
  IGST: 'IGST',
  EXPORT_LUT: 'EXPORT_LUT',
  EXPORT_WITH_IGST: 'EXPORT_WITH_IGST',
  SEZ_WITH_IGST: 'SEZ_WITH_IGST',
  SEZ_WITHOUT_IGST: 'SEZ_WITHOUT_IGST',
  UNDETERMINED: 'UNDETERMINED'
};

module.exports = {
  SUPPLY_TYPES,
  determineSupplyType,
  recomputeInvoiceFinancials,
  recomputeDocumentFinancials: recomputeInvoiceFinancials
};
