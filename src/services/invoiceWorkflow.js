const prisma = require("../config/prisma");
const InventoryService = require("./inventoryService");
const { roundHalfUp, getCurrencyDecimals } = require("./currencyFxService");
const { determineSupplyType } = require("./tax/supplyTypeEngine");

class InvoiceWorkflow {
  /**
   * Generates an Invoice automatically from an approved Sales Order
   * (Records item details, prorates or retains discount, recomputes grandTotal and baseCurrencyAmount)
   */
  static async createInvoiceFromSalesOrder(params) {
    const { businessId, salesOrderId, invoiceNumber, performedBy, extraData = {} } = params;

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Sales Order with its items and products, and Business
      const salesOrder = await tx.salesOrder.findFirst({
        where: { id: salesOrderId, businessId },
        include: {
          items: {
            include: { product: true }
          },
          customer: true
        }
      });

      if (!salesOrder) {
        throw new Error("Sales Order not found.");
      }

      if (salesOrder.status === "INVOICED") {
        throw new Error("Invoice already created for this Sales Order.");
      }

      const business = await tx.business.findUnique({
        where: { id: businessId },
        include: { baseCurrency: true }
      });
      if (!business) {
        throw new Error(`Business not found with ID: ${businessId}`);
      }

      // CBIC requirement: Indian business must have seller State and GSTIN
      const isIndiaBusiness = (business.countryCode === 'IN' || business.country === 'INDIA');
      if (isIndiaBusiness) {
        const missing = [];
        if (!business.state || !business.state.trim()) missing.push("State");
        if (!business.gstNumber || !business.gstNumber.trim()) missing.push("GSTIN");
        if (missing.length > 0) {
          throw new Error(
            `Cannot convert Sales Order to Invoice: Registered business ${missing.join(" and ")} is missing. ` +
            `Under CBIC regulations for Indian businesses, seller State and GSTIN are required to determine statutory Place of Supply. ` +
            `Please configure your business profile in Business Settings (/settings/company).`
          );
        }
      }

      const supplyRes = determineSupplyType(business, salesOrder.customer);
      if (supplyRes.supplyType === 'UNDETERMINED') {
        throw new Error(
          `Cannot convert Sales Order to Invoice: Place of Supply is UNDETERMINED (${supplyRes.reason}). ` +
          `Under GST regulations, buyer state and country must be specified to determine statutory tax applicability.`
        );
      }

      if (supplyRes.isExport) {
        if (!extraData.exportType) {
          throw new Error('Export invoice creation requires an explicit exportType ("LUT" or "WITH_PAYMENT_OF_IGST").');
        }
      }

      const currency = extraData.currency || salesOrder.currency || business.baseCurrency?.code || "INR";
      const txnDecimals = getCurrencyDecimals(currency);
      const baseCurrencyCode = business.baseCurrency?.code || business.currency || "INR";
      const baseDecimals = business.baseCurrency?.decimals !== undefined 
        ? business.baseCurrency.decimals 
        : getCurrencyDecimals(baseCurrencyCode);

      let invoiceSubtotal = 0;
      let headerCgst = 0;
      let headerSgst = 0;
      let headerIgst = 0;
      let invoiceTotalTax = 0;
      const invoiceItemsData = [];

      // 2. Loop through Sales Order items, strictly accounting for item discounts and tax percentages
      for (const item of salesOrder.items) {
        const qty = Number(item.quantity || 0);
        const prc = Number(item.price || 0);
        const itemDiscount = Number(item.discount || 0);
        const taxableAmount = Math.max((qty * prc) - itemDiscount, 0);

        let taxPercent = Number(item.taxPercent || 0);
        let cgstPercent = Number(item.cgstPercent || 0);
        let sgstPercent = Number(item.sgstPercent || 0);
        let igstPercent = Number(item.igstPercent || 0);

        if (isIndiaBusiness) {
          if (supplyRes.isExport) {
            const exportType = String(extraData.exportType).toUpperCase().trim();
            if (exportType === 'WITH_PAYMENT_OF_IGST') {
              igstPercent = taxPercent > 0 ? taxPercent : igstPercent;
              taxPercent = igstPercent;
            } else if (exportType === 'LUT') {
              taxPercent = 0;
              igstPercent = 0;
            } else {
              throw new Error(`Invalid exportType: "${extraData.exportType}". Must be "LUT" or "WITH_PAYMENT_OF_IGST".`);
            }
            cgstPercent = 0;
            sgstPercent = 0;
          } else if (supplyRes.isIntraState) {
            if (taxPercent === 0 && (cgstPercent > 0 || sgstPercent > 0)) {
              taxPercent = cgstPercent + sgstPercent;
            }
            cgstPercent = Number((taxPercent / 2).toFixed(2));
            sgstPercent = Number((taxPercent / 2).toFixed(2));
            igstPercent = 0;
          } else if (supplyRes.isInterState) {
            igstPercent = taxPercent > 0 ? taxPercent : igstPercent;
            taxPercent = igstPercent;
            cgstPercent = 0;
            sgstPercent = 0;
          }
        }

        const lineCgst = roundHalfUp(taxableAmount * (cgstPercent / 100), txnDecimals);
        const lineSgst = roundHalfUp(taxableAmount * (sgstPercent / 100), txnDecimals);
        const lineIgst = roundHalfUp(taxableAmount * (igstPercent / 100), txnDecimals);
        const itemTax = (lineCgst + lineSgst + lineIgst) > 0 
          ? (lineCgst + lineSgst + lineIgst) 
          : roundHalfUp(taxableAmount * (taxPercent / 100), txnDecimals);
        const lineTotal = roundHalfUp(taxableAmount + itemTax, txnDecimals);

        invoiceSubtotal += taxableAmount;
        headerCgst += lineCgst;
        headerSgst += lineSgst;
        headerIgst += lineIgst;
        invoiceTotalTax += itemTax;

        invoiceItemsData.push({
          productId: item.productId,
          warehouseId: item.warehouseId,
          description: item.description || (item.product ? item.product.name : "Item"),
          quantity: qty,
          hours: qty, // Preserve backward compatibility with hours
          rate: prc,
          hsnSacCode: item.hsnSacCode || (item.product ? item.product.taxCode : null),
          amount: taxableAmount, // net taxable amount after item discount
          discount: itemDiscount,
          taxPercent,
          cgstPercent,
          sgstPercent,
          igstPercent,
          totalTax: itemTax,
          totalAmount: lineTotal,
          unit: item.unit || 'pcs'
        });
      }

      invoiceSubtotal = roundHalfUp(invoiceSubtotal, txnDecimals);
      headerCgst = roundHalfUp(headerCgst, txnDecimals);
      headerSgst = roundHalfUp(headerSgst, txnDecimals);
      headerIgst = roundHalfUp(headerIgst, txnDecimals);
      invoiceTotalTax = roundHalfUp(invoiceTotalTax, txnDecimals);

      const discount = Number(extraData.discount !== undefined ? extraData.discount : (salesOrder.discount || 0));
      const shippingCharges = Number(extraData.shippingCharges !== undefined ? extraData.shippingCharges : (salesOrder.shippingCharges || 0));
      const tds = Number(extraData.tds !== undefined ? extraData.tds : (salesOrder.tds || 0));
      const grandTotal = roundHalfUp(invoiceSubtotal + invoiceTotalTax + shippingCharges - discount - tds, txnDecimals);

      const exchangeRate = Number(extraData.exchangeRate || salesOrder.exchangeRate || 1);
      const statutoryExchangeRate = Number(extraData.statutoryExchangeRate || salesOrder.statutoryExchangeRate || exchangeRate);
      const baseCurrencyAmount = roundHalfUp(grandTotal * exchangeRate, baseDecimals);
      const statutoryBaseAmount = roundHalfUp(grandTotal * statutoryExchangeRate, baseDecimals);

      // 3. Create the Invoice record with all preserved fields
      const invoice = await tx.invoice.create({
        data: {
          businessId,
          customerId: salesOrder.customerId,
          contactId: extraData.contactId || salesOrder.contactId || null,
          quotationId: salesOrder.quotationId || null,
          salesOrderId: salesOrder.id,
          invoiceNumber,
          subtotal: invoiceSubtotal,
          totalTax: invoiceTotalTax,
          discount,
          grandTotal,
          status: "UNPAID",
          currency,
          exchangeRate,
          baseCurrencyAmount,
          baseCurrencyId: salesOrder.baseCurrencyId || business.baseCurrencyId,
          statutoryBaseAmount,
          statutoryExchangeRate,
          transactionCurrencyId: salesOrder.transactionCurrencyId,
          shippingCharges,
          cgst: headerCgst,
          sgst: headerSgst,
          igst: headerIgst,
          vatAmount: Number(extraData.vatAmount || salesOrder.vatAmount || 0),
          tds,
          soNumber: salesOrder.orderNumber,
          soDate: salesOrder.orderDate,
          poNumber: extraData.poNumber || salesOrder.customerReference || null,
          terms: extraData.terms || salesOrder.termsConditions || null,
          adminNote: extraData.adminNote || salesOrder.notes || null,
          ewayBillNo: extraData.ewayBillNo || salesOrder.ewayBillNo || null,
          reverseCharge: extraData.reverseCharge !== undefined ? !!extraData.reverseCharge : (salesOrder.reverseCharge || false),
          transportDetails: extraData.transportDetails || salesOrder.transportDetails || null,
          vatPercentage: Number(extraData.vatPercentage || salesOrder.vatPercentage || 0),
          vatType: extraData.vatType || salesOrder.vatType,
          emirate: extraData.emirate || salesOrder.emirate,
          projectId: extraData.projectId || null,
          items: {
            create: invoiceItemsData
          }
        },
        include: {
          items: true
        }
      });

      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: "INVOICED" }
      });

      // 4.5 Update Project Revenue if projectId is present
      if (extraData.projectId) {
        await tx.project.update({
          where: { id: extraData.projectId },
          data: {
            revenue: { increment: invoice.grandTotal },
            invoicedRevenue: { increment: invoice.grandTotal }
          }
        });
      }

      // 5. Release Reserved quantities and deduct physical stock (Sales Flow Shipment)
      for (const item of invoice.items) {
        if (item.productId && item.warehouseId) {
          // Release the reservation held by the Sales Order (if reservedQty was allocated)
          try {
            await InventoryService.releaseReservation({
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: item.quantity,
              tx
            });
          } catch (e) {
            console.warn("Reservation release skipped/failed:", e.message);
          }

          // Deduct physical stock and write audit ledger
          await InventoryService.decreaseStock({
            businessId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            type: "SALE_OUT",
            reference: {
              salesOrderId: salesOrder.id,
              invoiceId: invoice.id
            },
            performedBy,
            tx
          });
        }
      }

      return invoice;
    }, {
      maxWait: 5000, // default
      timeout: 20000 // 20 seconds
    });
  }
}

module.exports = InvoiceWorkflow;
