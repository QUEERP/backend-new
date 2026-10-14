// src/config/reports/statutoryRegistry.js
const prisma = require("../../config/prisma");

/**
 * Statutory Report Registry
 * Maps TaxFramework string codes (from DB) to available statutory reports and their builder functions.
 */
const registry = {
  // INDIA GST Framework
  "India GST": {
    reports: [
      { code: "GSTR1", name: "GSTR-1 (Outward Supplies)", type: "SALES_REGISTER" },
      { code: "GSTR3B", name: "GSTR-3B (Summary Return)", type: "SUMMARY" }
    ],
    builders: {
      "GSTR1": async (businessId, filters = {}) => {
        const { isInterStateSupply } = require("../../services/gstTaxReportService");

        const business = await prisma.business.findUnique({
          where: { id: businessId },
          include: { baseCurrency: true }
        });

        const invoiceWhere = {
          businessId,
          isDeleted: false,
          status: { notIn: ['DRAFT', 'CANCELLED'] }
        };

        const from = filters.fromDate || filters.startDate;
        const to = filters.toDate || filters.endDate;
        if (from || to) {
          invoiceWhere.invoiceDate = {};
          if (from) invoiceWhere.invoiceDate.gte = new Date(from);
          if (to) invoiceWhere.invoiceDate.lte = new Date(to);
        }

        const invoices = await prisma.invoice.findMany({
          where: invoiceWhere,
          include: {
            customer: true,
            items: true,
            transactionCurrency: true
          },
          orderBy: { invoiceDate: 'asc' }
        });

        const grouped = {};
        const rateInvoicesMap = {};

        invoices.forEach(inv => {
          const fx = Number(inv.exchangeRate || 1);
          const isInter = isInterStateSupply(business, inv.customer) === true;

          if (inv.items && inv.items.length > 0) {
            inv.items.forEach(t => {
              let rate = Number(t.taxPercent ?? ((Number(t.cgstPercent || 0) + Number(t.sgstPercent || 0) + Number(t.igstPercent || 0))));
              if (rate === 0 && Number(inv.totalTax || 0) > 0 && Number(inv.subtotal || 0) > 0) {
                rate = Number(((Number(inv.totalTax) / Number(inv.subtotal)) * 100).toFixed(2));
              }

              const key = rate.toString();
              if (!grouped[key]) {
                grouped[key] = {
                  taxRate: rate,
                  taxableAmount: 0,
                  CGST: 0,
                  SGST: 0,
                  IGST: 0,
                  totalTax: 0,
                  totalTaxBaseCcy: 0,
                  totalAmount: 0,
                  invoiceCount: 0
                };
                rateInvoicesMap[key] = new Set();
              }

              const itemAmt = Number(t.amount || (Number(t.quantity || 1) * Number(t.rate || 0)) || 0);
              const taxableBase = Number((itemAmt * fx).toFixed(2));
              const taxBase = Number(((t.totalTax != null && t.totalTax > 0 ? t.totalTax : (itemAmt * rate / 100)) * fx).toFixed(2));

              let cgst = 0;
              let sgst = 0;
              let igst = 0;

              if (Number(t.igstPercent || 0) > 0) {
                igst = taxBase;
              } else if (Number(t.cgstPercent || 0) > 0 || Number(t.sgstPercent || 0) > 0) {
                cgst = Number((taxBase / 2).toFixed(2));
                sgst = Number((taxBase - cgst).toFixed(2));
              } else {
                if (isInter) {
                  igst = taxBase;
                } else {
                  cgst = Number((taxBase / 2).toFixed(2));
                  sgst = Number((taxBase - cgst).toFixed(2));
                }
              }

              grouped[key].taxableAmount = Number((grouped[key].taxableAmount + taxableBase).toFixed(2));
              grouped[key].CGST = Number((grouped[key].CGST + cgst).toFixed(2));
              grouped[key].SGST = Number((grouped[key].SGST + sgst).toFixed(2));
              grouped[key].IGST = Number((grouped[key].IGST + igst).toFixed(2));
              grouped[key].totalTax = Number((grouped[key].totalTax + taxBase).toFixed(2));
              grouped[key].totalTaxBaseCcy = Number((grouped[key].totalTaxBaseCcy + taxBase).toFixed(2));
              grouped[key].totalAmount = Number((grouped[key].totalAmount + taxableBase + taxBase).toFixed(2));
              rateInvoicesMap[key].add(inv.id);
            });
          } else {
            // Header-only fallback
            const subtotalBase = Number(((inv.subtotal || 0) * fx).toFixed(2));
            const taxBase = Number(((inv.totalTax || 0) * fx).toFixed(2));
            const rate = subtotalBase > 0 && taxBase > 0 ? Number(((taxBase / subtotalBase) * 100).toFixed(2)) : 0;
            const key = rate.toString();

            if (!grouped[key]) {
              grouped[key] = {
                taxRate: rate,
                taxableAmount: 0,
                CGST: 0,
                SGST: 0,
                IGST: 0,
                totalTax: 0,
                totalTaxBaseCcy: 0,
                totalAmount: 0,
                invoiceCount: 0
              };
              rateInvoicesMap[key] = new Set();
            }

            let cgst = 0;
            let sgst = 0;
            let igst = 0;
            if (isInter) {
              igst = taxBase;
            } else {
              cgst = Number((taxBase / 2).toFixed(2));
              sgst = Number((taxBase - cgst).toFixed(2));
            }

            grouped[key].taxableAmount = Number((grouped[key].taxableAmount + subtotalBase).toFixed(2));
            grouped[key].CGST = Number((grouped[key].CGST + cgst).toFixed(2));
            grouped[key].SGST = Number((grouped[key].SGST + sgst).toFixed(2));
            grouped[key].IGST = Number((grouped[key].IGST + igst).toFixed(2));
            grouped[key].totalTax = Number((grouped[key].totalTax + taxBase).toFixed(2));
            grouped[key].totalTaxBaseCcy = Number((grouped[key].totalTaxBaseCcy + taxBase).toFixed(2));
            grouped[key].totalAmount = Number((grouped[key].totalAmount + subtotalBase + taxBase).toFixed(2));
            rateInvoicesMap[key].add(inv.id);
          }
        });

        // Set invoice counts per rate
        Object.keys(grouped).forEach(k => {
          grouped[k].invoiceCount = rateInvoicesMap[k] ? rateInvoicesMap[k].size : 0;
        });

        const rateRows = Object.values(grouped).sort((a, b) => a.taxRate - b.taxRate);

        // Build invoice outward supply line items (B2B & B2C)
        const invoiceRows = invoices.map(inv => {
          const fx = Number(inv.exchangeRate || 1);
          const isInter = isInterStateSupply(business, inv.customer) === true;
          const subtotalBase = Number(((inv.subtotal || 0) * fx).toFixed(2));
          const taxBase = Number(((inv.totalTax || 0) * fx).toFixed(2));
          const totalBase = Number(((inv.grandTotal || (inv.subtotal + inv.totalTax) || 0) * fx).toFixed(2));

          let invCgst = 0, invSgst = 0, invIgst = 0, maxRate = 0;
          if (inv.items && inv.items.length > 0) {
            inv.items.forEach(t => {
              const itRate = Number(t.taxPercent ?? ((Number(t.cgstPercent || 0) + Number(t.sgstPercent || 0) + Number(t.igstPercent || 0))));
              if (itRate > maxRate) maxRate = itRate;
              const itAmt = Number(t.amount || 0);
              const itTax = Number(((t.totalTax != null && t.totalTax > 0 ? t.totalTax : (itAmt * itRate / 100)) * fx).toFixed(2));
              if (Number(t.igstPercent || 0) > 0 || isInter) {
                invIgst += itTax;
              } else {
                const half = Number((itTax / 2).toFixed(2));
                invCgst += half;
                invSgst += (itTax - half);
              }
            });
          } else {
            maxRate = subtotalBase > 0 && taxBase > 0 ? Number(((taxBase / subtotalBase) * 100).toFixed(2)) : 0;
            if (isInter) {
              invIgst = taxBase;
            } else {
              invCgst = Number((taxBase / 2).toFixed(2));
              invSgst = Number((taxBase - invCgst).toFixed(2));
            }
          }

          const gstin = inv.customer?.gstin || inv.customer?.taxId || '';
          const isB2B = Boolean(gstin && gstin.trim().length >= 10);

          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate || inv.createdAt,
            customerName: inv.customer?.company || inv.customer?.name || 'Walk-in Customer',
            gstin: gstin || 'URP (Unregistered)',
            supplyType: isB2B ? 'B2B' : 'B2C',
            placeOfSupply: isInter ? 'Inter-State' : 'Intra-State',
            taxableAmount: subtotalBase,
            taxRate: maxRate,
            cgst: Number(invCgst.toFixed(2)),
            sgst: Number(invSgst.toFixed(2)),
            igst: Number(invIgst.toFixed(2)),
            totalTax: taxBase,
            totalAmount: totalBase,
            status: inv.status
          };
        });

        // Build HSN / SAC Summary
        const hsnGrouped = {};
        invoices.forEach(inv => {
          const fx = Number(inv.exchangeRate || 1);
          const isInter = isInterStateSupply(business, inv.customer) === true;
          (inv.items || []).forEach(t => {
            const hsn = t.hsnSacCode || 'N/A';
            const itRate = Number(t.taxPercent ?? ((Number(t.cgstPercent || 0) + Number(t.sgstPercent || 0) + Number(t.igstPercent || 0))));
            const itAmt = Number(t.amount || 0);
            const taxableBase = Number((itAmt * fx).toFixed(2));
            const itTax = Number(((t.totalTax != null && t.totalTax > 0 ? t.totalTax : (itAmt * itRate / 100)) * fx).toFixed(2));

            if (!hsnGrouped[hsn]) {
              hsnGrouped[hsn] = {
                hsnCode: hsn,
                description: t.description || t.itemName || 'Supplies',
                uqc: t.unit || 'NOS',
                totalQuantity: 0,
                taxableAmount: 0,
                taxRate: itRate,
                cgst: 0,
                sgst: 0,
                igst: 0,
                totalTax: 0
              };
            }

            hsnGrouped[hsn].totalQuantity += Number(t.quantity || 1);
            hsnGrouped[hsn].taxableAmount = Number((hsnGrouped[hsn].taxableAmount + taxableBase).toFixed(2));
            hsnGrouped[hsn].totalTax = Number((hsnGrouped[hsn].totalTax + itTax).toFixed(2));
            if (Number(t.igstPercent || 0) > 0 || isInter) {
              hsnGrouped[hsn].igst = Number((hsnGrouped[hsn].igst + itTax).toFixed(2));
            } else {
              const half = Number((itTax / 2).toFixed(2));
              hsnGrouped[hsn].cgst = Number((hsnGrouped[hsn].cgst + half).toFixed(2));
              hsnGrouped[hsn].sgst = Number((hsnGrouped[hsn].sgst + (itTax - half)).toFixed(2));
            }
          });
        });

        const hsnRows = Object.values(hsnGrouped);

        const summaryTotals = {
          totalInvoices: invoices.length,
          totalTaxableAmount: Number(rateRows.reduce((sum, r) => sum + r.taxableAmount, 0).toFixed(2)),
          totalCgst: Number(rateRows.reduce((sum, r) => sum + r.CGST, 0).toFixed(2)),
          totalSgst: Number(rateRows.reduce((sum, r) => sum + r.SGST, 0).toFixed(2)),
          totalIgst: Number(rateRows.reduce((sum, r) => sum + r.IGST, 0).toFixed(2)),
          totalTax: Number(rateRows.reduce((sum, r) => sum + r.totalTax, 0).toFixed(2)),
          totalAmount: Number(rateRows.reduce((sum, r) => sum + r.totalAmount, 0).toFixed(2))
        };

        return {
          reportName: "GSTR-1 (Outward Supplies)",
          data: rateRows,
          invoices: invoiceRows,
          hsnSummary: hsnRows,
          summary: summaryTotals,
          sections: [
            {
              name: "Rate-wise Tax Summary (Table 8)",
              data: rateRows
            },
            {
              name: "Outward Taxable Supplies (B2B / B2C Invoices)",
              data: invoiceRows
            },
            {
              name: "HSN / SAC Summary (Table 12)",
              data: hsnRows
            }
          ]
        };
      },
      "GSTR3B": async (businessId, filters = {}) => {
        const invoiceWhere = {
          businessId,
          isDeleted: false,
          status: { notIn: ['DRAFT', 'CANCELLED'] }
        };
        const from = filters.fromDate || filters.startDate;
        const to = filters.toDate || filters.endDate;
        if (from || to) {
          invoiceWhere.invoiceDate = {};
          if (from) invoiceWhere.invoiceDate.gte = new Date(from);
          if (to) invoiceWhere.invoiceDate.lte = new Date(to);
        }

        const invoices = await prisma.invoice.findMany({
          where: invoiceWhere,
          include: { items: true }
        });

        // Initialize structures
        const table3_1 = {
          "(a) Outward taxable supplies (other than zero rated, nil rated and exempted)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(b) Outward taxable supplies (zero rated)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(c) Other outward supplies (Nil rated, exempted)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(d) Inward supplies (liable to reverse charge)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(e) Non-GST outward supplies": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 }
        };

        const table4 = {
          "(A)(3) Inward supplies liable to reverse charge": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(A)(5) All other ITC": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(B) ITC Reversed": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(C) Net ITC Available (A) - (B)": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(D) Ineligible ITC": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 }
        };

        // Helper to add values
        const addValues = (target, item, sign, isTable4 = false) => {
          if (!isTable4) {
            target.taxableValue += (item.amount || 0) * sign;
          }
          const amt = (item.totalTax || 0) * sign;
          if (item.cgstPercent > 0) {
            target.CGST += amt / 2;
            target.SGST += amt / 2;
          }
          if (item.igstPercent > 0) {
            target.IGST += amt;
          }
        };

        invoices.forEach(inv => {
          (inv.items || []).forEach(t => {
            const type = 'INVOICE';
            const rate = Number(t.taxPercent ?? ((Number(t.cgstPercent || 0) + Number(t.sgstPercent || 0) + Number(t.igstPercent || 0))));
            const cat = null;

            // TABLE 3.1
            if (['INVOICE', 'CREDIT_NOTE'].includes(type)) {
              const sign = type === 'CREDIT_NOTE' ? -1 : 1;
              if (rate > 0 && cat !== 'ZERO_RATED' && cat !== 'REVERSE_CHARGE') {
                addValues(table3_1["(a) Outward taxable supplies (other than zero rated, nil rated and exempted)"], t, sign);
              } else if (cat === 'ZERO_RATED') {
                addValues(table3_1["(b) Outward taxable supplies (zero rated)"], t, sign);
              } else if (rate === 0) {
                addValues(table3_1["(c) Other outward supplies (Nil rated, exempted)"], t, sign);
              }
            }
          });
        });

        const billWhere = {
          businessId,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] }
        };
        if (from || to) {
          billWhere.billDate = {};
          if (from) billWhere.billDate.gte = new Date(from);
          if (to) billWhere.billDate.lte = new Date(to);
        }

        const bills = await prisma.bill.findMany({
          where: billWhere,
          include: { items: true }
        });

        bills.forEach(bill => {
          (bill.items || []).forEach(t => {
            const rate = Number(t.taxPercent ?? ((Number(t.cgstPercent || 0) + Number(t.sgstPercent || 0) + Number(t.igstPercent || 0))));
            if (rate > 0) {
              addValues(table4["(A)(5) All other ITC"], t, 1, true);
            }
          });
        });

        // Compute (C) Net ITC Available
        ['CGST', 'SGST', 'IGST', 'CESS'].forEach(tax => {
          const a = table4["(A)(3) Inward supplies liable to reverse charge"][tax] +
            table4["(A)(5) All other ITC"][tax];
          const b = table4["(B) ITC Reversed"][tax];
          table4["(C) Net ITC Available (A) - (B)"][tax] = a - b;
        });

        // Format for response
        const formatTable = (tableObj) => {
          return Object.entries(tableObj).map(([category, values]) => ({
            category,
            ...values
          }));
        };

        const sec31 = formatTable(table3_1);
        const sec4 = formatTable(table4);

        return {
          reportName: "GSTR-3B (Summary Return)",
          data: [...sec31, ...sec4],
          sections: [
            {
              name: "3.1 Details of Outward Supplies and inward supplies liable to reverse charge",
              data: sec31
            },
            {
              name: "4. Eligible ITC",
              data: sec4
            }
          ]
        };
      }
    }
  },

  // UAE VAT Framework
  "UAE VAT": {
    reports: [
      { code: "UAE_VAT_RETURN", name: "UAE VAT Return (Form 201)", type: "SUMMARY" },
      { code: "UAE_VAT_OUTPUT", name: "Output Tax Register", type: "SALES_REGISTER" }
    ],
    builders: {
      "UAE_VAT_RETURN": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: { businessId }
        });

        // Resolve TaxType and TaxRule names by taxRateId (no direct relation on TaxTransaction)
        const taxRateIds = [...new Set(transactions.map(t => t.taxRateId).filter(Boolean))];
        const taxRates = taxRateIds.length > 0
          ? await prisma.taxRate.findMany({ where: { id: { in: taxRateIds } }, include: { taxType: true, taxRule: true } })
          : [];
        const taxRateMap = Object.fromEntries(taxRates.map(r => [r.id, r]));

        const boxes = {
          box1: { box: "1", description: "Standard rated supplies", amount: 0, vatAmount: 0 },
          box3: { box: "3", description: "Supplies subject to the reverse charge provisions (Output)", amount: 0, vatAmount: 0 },
          box4: { box: "4", description: "Zero rated supplies", amount: 0, vatAmount: 0 },
          box5: { box: "5", description: "Exempt supplies", amount: 0, vatAmount: 0 },
          box9: { box: "9", description: "Standard rated expenses", amount: 0, vatAmount: 0 },
          box10: { box: "10", description: "Supplies subject to the reverse charge provisions (Input)", amount: 0, vatAmount: 0 },
        };

        transactions.forEach(t => {
          const resolvedRate = t.taxRateId ? taxRateMap[t.taxRateId] : null;

          // Map rule type to box category if available; else fallback to taxType.name or overrideTaxType
          let typeName = 'UNKNOWN';
          if (resolvedRate?.taxRule?.type) {
            const rt = resolvedRate.taxRule.type;
            if (rt === 'STANDARD') typeName = 'VAT_STANDARD';
            else if (rt === 'ZERO_RATED') typeName = 'VAT_ZERO';
            else if (rt === 'EXEMPT') typeName = 'VAT_EXEMPT';
            else if (rt === 'REVERSE_CHARGE') typeName = 'VAT_REVERSE_CHARGE';
          } else {
            typeName = resolvedRate?.taxType?.name ?? t.overrideTaxType?.name ?? 'UNKNOWN';
          }

          const isOutward = ['INVOICE', 'CREDIT_NOTE'].includes(t.transactionType);
          const isInward = ['BILL', 'PURCHASE_RETURN'].includes(t.transactionType);

          const sign = ['CREDIT_NOTE', 'PURCHASE_RETURN'].includes(t.transactionType) ? -1 : 1;
          const taxableAmt = t.taxableAmountBaseCcy * sign;
          const taxAmt = t.taxAmountBaseCcy * sign;

          if (isOutward) {
            if (typeName === 'VAT_STANDARD') {
              boxes.box1.amount += taxableAmt;
              boxes.box1.vatAmount += taxAmt;
            } else if (typeName === 'VAT_ZERO') {
              boxes.box4.amount += taxableAmt;
              boxes.box4.vatAmount += taxAmt;
            } else if (typeName === 'VAT_EXEMPT') {
              boxes.box5.amount += taxableAmt;
              boxes.box5.vatAmount += taxAmt;
            }
          }

          if (isInward) {
            if (typeName === 'VAT_STANDARD') {
              boxes.box9.amount += taxableAmt;
              boxes.box9.vatAmount += taxAmt;
            } else if (typeName === 'VAT_REVERSE_CHARGE') {
              // Reverse charge appears in BOTH Output (Box 3) and Input (Box 10)
              boxes.box3.amount += taxableAmt;
              boxes.box3.vatAmount += taxAmt;
              boxes.box10.amount += taxableAmt;
              boxes.box10.vatAmount += taxAmt;
            }
          }
        });

        return {
          reportName: "UAE VAT Return (Form 201)",
          data: Object.values(boxes)
        };
      },
      "UAE_VAT_OUTPUT": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: {
            businessId,
            transactionType: { in: ['INVOICE', 'CREDIT_NOTE'] }
          },
          orderBy: { createdAt: 'asc' }
        });

        // Resolve TaxType and TaxRule names by taxRateId
        const taxRateIds = [...new Set(transactions.map(t => t.taxRateId).filter(Boolean))];
        const taxRates = taxRateIds.length > 0
          ? await prisma.taxRate.findMany({ where: { id: { in: taxRateIds } }, include: { taxType: true, taxRule: true } })
          : [];
        const taxRateMap = Object.fromEntries(taxRates.map(r => [r.id, r]));

        const data = transactions.map(t => {
          const resolvedRate = t.taxRateId ? taxRateMap[t.taxRateId] : null;

          let typeName = 'UNKNOWN';
          if (resolvedRate?.taxRule?.type) {
            const rt = resolvedRate.taxRule.type;
            if (rt === 'STANDARD') typeName = 'VAT_STANDARD';
            else if (rt === 'ZERO_RATED') typeName = 'VAT_ZERO';
            else if (rt === 'EXEMPT') typeName = 'VAT_EXEMPT';
            else if (rt === 'REVERSE_CHARGE') typeName = 'VAT_REVERSE_CHARGE';
          } else {
            typeName = resolvedRate?.taxType?.name ?? t.overrideTaxType?.name ?? 'UNKNOWN';
          }

          const sign = t.transactionType === 'CREDIT_NOTE' ? -1 : 1;
          return {
            "Date": t.createdAt.toISOString().split('T')[0],
            "Document Type": t.transactionType,
            "Document Number": t.transactionId,
            "Tax Type": typeName,
            "Tax Rate (%)": resolvedRate?.rate ?? t.overrideRate ?? 0,
            "Taxable Amount (Base)": (t.taxableAmountBaseCcy || 0) * sign,
            "Tax Amount (Base)": t.taxAmountBaseCcy * sign
          };
        });

        return {
          reportName: "Output Tax Register",
          data
        };
      }
    }
  },

  // Canada GST/HST Framework
  "Canada GST/HST": {
    reports: [
      { code: "CA_GST_HST_RETURN", name: "GST/HST Return", type: "SUMMARY" }
    ],
    builders: {
      "CA_GST_HST_RETURN": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: { businessId },
          include: { taxRate: { include: { taxType: true } }, overrideTaxType: true }
        });

        let totalCollected = 0;
        let totalPaid = 0;

        transactions.forEach(t => {
          const typeName = t.taxRate?.taxType?.name ?? t.overrideTaxType?.name ?? 'UNKNOWN';
          const isOutward = ['INVOICE', 'CREDIT_NOTE'].includes(t.transactionType);
          const isInward = ['BILL', 'PURCHASE_RETURN'].includes(t.transactionType);

          const sign = ['CREDIT_NOTE', 'PURCHASE_RETURN'].includes(t.transactionType) ? -1 : 1;
          const taxAmt = t.taxAmountBaseCcy * sign;

          if (isOutward) {
            totalCollected += taxAmt;
          } else if (isInward) {
            totalPaid += taxAmt;
          }
        });

        const netTax = totalCollected - totalPaid;

        return {
          reportName: "GST/HST Return",
          sections: [
            {
              name: "Summary",
              data: [
                { category: "Total Tax Collected (Sales)", amount: totalCollected },
                { category: "Total Tax Paid (Purchases)", amount: totalPaid },
                { category: "Net Tax (Collected - Paid)", amount: netTax }
              ]
            }
          ]
        };
      }
    }
  },

  // UK VAT Framework
  "UK VAT": {
    reports: [
      { code: "UK_VAT_GENERIC_RETURN", name: "Generic Tax Return", type: "SUMMARY" }
    ],
    builders: {
      "UK_VAT_GENERIC_RETURN": async (businessId, filters) => {
        return await buildGenericReturn(businessId, filters, "Generic Tax Return");
      }
    }
  },

  // AU GST Framework
  "AU GST": {
    reports: [
      { code: "AU_GST_GENERIC_RETURN", name: "Generic Tax Return", type: "SUMMARY" }
    ],
    builders: {
      "AU_GST_GENERIC_RETURN": async (businessId, filters) => {
        return await buildGenericReturn(businessId, filters, "Generic Tax Return");
      }
    }
  },

  // SG GST Framework
  "SG GST": {
    reports: [
      { code: "SG_GST_GENERIC_RETURN", name: "Generic Tax Return", type: "SUMMARY" }
    ],
    builders: {
      "SG_GST_GENERIC_RETURN": async (businessId, filters) => {
        return await buildGenericReturn(businessId, filters, "Generic Tax Return");
      }
    }
  },

  // Deutschland MwSt Framework
  "Deutschland MwSt": {
    reports: [
      { code: "DEUTSCHLAND_MWST_GENERIC_RETURN", name: "Generic Tax Return", type: "SUMMARY" }
    ],
    builders: {
      "DEUTSCHLAND_MWST_GENERIC_RETURN": async (businessId, filters) => {
        return await buildGenericReturn(businessId, filters, "Generic Tax Return");
      }
    }
  },

  // NZ GST Framework
  "NZ GST": {
    reports: [
      { code: "NZ_GST_GENERIC_RETURN", name: "Generic Tax Return", type: "SUMMARY" }
    ],
    builders: {
      "NZ_GST_GENERIC_RETURN": async (businessId, filters) => {
        return await buildGenericReturn(businessId, filters, "Generic Tax Return");
      }
    }
  },

  // South Africa VAT Framework
  "South Africa VAT": {
    reports: [
      { code: "SOUTH_AFRICA_VAT_GENERIC_RETURN", name: "Generic Tax Return", type: "SUMMARY" }
    ],
    builders: {
      "SOUTH_AFRICA_VAT_GENERIC_RETURN": async (businessId, filters) => {
        return await buildGenericReturn(businessId, filters, "Generic Tax Return");
      }
    }
  },
};

// Generic builder for simple net-tax returns
const buildGenericReturn = async (businessId, filters, reportName) => {
  const invoiceWhere = {
    businessId,
    isDeleted: false,
    status: { notIn: ['DRAFT', 'CANCELLED'] }
  };
  const billWhere = {
    businessId,
    status: { in: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] }
  };

  const from = filters?.fromDate || filters?.startDate;
  const to = filters?.toDate || filters?.endDate;
  if (from || to) {
    invoiceWhere.invoiceDate = {};
    billWhere.billDate = {};
    if (from) {
      invoiceWhere.invoiceDate.gte = new Date(from);
      billWhere.billDate.gte = new Date(from);
    }
    if (to) {
      invoiceWhere.invoiceDate.lte = new Date(to);
      billWhere.billDate.lte = new Date(to);
    }
  }

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere
  });
  const bills = await prisma.bill.findMany({
    where: billWhere
  });

  let totalCollected = 0;
  let totalPaid = 0;

  invoices.forEach(t => {
    totalCollected += t.totalTax || 0;
  });

  bills.forEach(t => {
    totalPaid += t.totalTax || t.tax || 0;
  });

  const summaryData = [
    { category: "Total Tax Collected (Sales)", amount: totalCollected },
    { category: "Total Tax Paid (Purchases)", amount: totalPaid },
    { category: "Net Tax (Collected - Paid)", amount: (totalCollected - totalPaid) }
  ];

  return {
    reportName,
    data: summaryData,
    sections: [
      {
        name: "Summary",
        data: summaryData
      }
    ]
  };
};

const { PROVISIONING_MANIFESTS } = require('../../services/taxProvisioning.service');

// Dynamically register a generic return for EVERY framework in PROVISIONING_MANIFESTS
for (const countryCode of Object.keys(PROVISIONING_MANIFESTS)) {
  const fwName = PROVISIONING_MANIFESTS[countryCode].frameworkName;
  const reportCode = `${fwName.toUpperCase().replace(/[\s/]+/g, '_')}_GENERIC_RETURN`;
  // e.g. "Austria USt" -> "USt Return"
  const reportDisplayName = `${fwName.split(' ').pop()} Return`;

  if (!registry[fwName]) {
    registry[fwName] = { reports: [], builders: {} };
  }

  if (!registry[fwName].reports.find(r => r.code === reportCode)) {
    registry[fwName].reports.push({
      code: reportCode,
      name: reportDisplayName,
      type: "SUMMARY"
    });
    registry[fwName].builders[reportCode] = async (businessId, filters) => {
      return await buildGenericReturn(businessId, filters, reportDisplayName);
    };
  }
}


/**
 * Get available reports for a given framework.
 */
exports.getAvailableReports = (frameworkName) => {
  if (!frameworkName || !registry[frameworkName]) {
    return [];
  }
  return registry[frameworkName].reports;
};

/**
 * Execute a specific statutory report.
 */
exports.generateReport = async (frameworkName, reportCode, businessId, filters) => {
  if (!frameworkName || !registry[frameworkName]) {
    throw new Error(`Tax Framework ${frameworkName} not supported for statutory reporting.`);
  }

  const builder = registry[frameworkName].builders[reportCode];
  if (!builder) {
    throw new Error(`Report code ${reportCode} not found in framework ${frameworkName}.`);
  }

  // Ensure mandatory businessId scope is enforced at the highest level
  return await builder(businessId, filters);
};
