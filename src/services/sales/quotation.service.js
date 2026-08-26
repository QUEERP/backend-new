const prisma = require("../../config/prisma");
const { logAction, triggerNotification } = require("./audit.service");
const TransactionHelper = require("../TransactionHelper");
const { CurrencyService } = require("../currencyService");

/**
 * Robust document number generator preventing duplicates and collision on deletion.
 */
const generateDocNumber = async (tx, businessId, prefix, modelName, fieldName) => {
  let nextNum = 1;
  const lastRecord = await tx[modelName].findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { [fieldName]: true }
  });
  
  if (lastRecord && lastRecord[fieldName]) {
    const parts = lastRecord[fieldName].split("-");
    const numStr = parts[parts.length - 1];
    nextNum = isNaN(parseInt(numStr, 10)) ? 1 : parseInt(numStr, 10) + 1;
  }

  let docNumber = "";
  let isUnique = false;
  let loopCount = 0;

  while (!isUnique) {
    loopCount++;
    if (loopCount > 100) {
      throw new Error("Failed to generate a unique document number after 100 attempts.");
    }
    docNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`;
    const existing = await tx[modelName].findFirst({
      where: { [fieldName]: docNumber, businessId }
    });
    
    if (!existing) {
      isUnique = true;
    } else {
      nextNum++;
    }
  }

  return docNumber;
};

/**
 * Calculates item totals and aggregates.
 */
const calculatePricing = (items, globalDiscount = 0, globalTaxRate = 0) => {
  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  const processedItems = items.map((item) => {
    const qty = Number(item.quantity || 0);
    const prc = Number(item.price || 0);
    const disc = Number(item.discount || 0);
    const taxRate = Number(item.taxPercent || 0);

    const baseAmount = qty * prc;
    const itemDiscount = disc;
    const taxableAmount = Math.max(baseAmount - itemDiscount, 0);
    const itemTax = taxableAmount * (taxRate / 100);
    const total = taxableAmount + itemTax;

    subtotal += baseAmount;
    totalTax += itemTax;
    totalDiscount += itemDiscount;

    return {
      productId: item.productId || null,
      warehouseId: item.warehouseId || null,
      itemName: item.itemName || null,
      description: item.description || "",
      itemType: item.itemType || "GOODS",
      hsnSacCode: item.hsnSacCode || null,
      quantity: qty,
      price: prc,
      taxPercent: taxRate,
      cgstPercent: Number(item.cgstPercent || 0),
      sgstPercent: Number(item.sgstPercent || 0),
      igstPercent: Number(item.igstPercent || 0),
      taxDetails: item.taxDetails || [],
      discount: itemDiscount,
      total
    };
  });

  const globalTaxAmount = Math.max(subtotal - totalDiscount - globalDiscount, 0) * (globalTaxRate / 100);
  const totalAmount = subtotal + totalTax + globalTaxAmount - totalDiscount - globalDiscount;

  return {
    subtotal,
    tax: totalTax + globalTaxAmount,
    discount: totalDiscount + globalDiscount,
    totalAmount,
    processedItems
  };
};

const createQuotation = async (businessId, userId, userEmail, data) => {
  const MAX_RETRIES = 3;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Generate unique quote number
        const quoteNumber = await generateDocNumber(tx, businessId, "QT", "quotation", "quoteNumber");

        const transactionDate = data.issueDate ? new Date(data.issueDate) : new Date();
        const discount = Number(data.discount || 0);

        // 2. Compute Financials via Engine (Taxes, Exchange Rates, Projections)
        const financials = await TransactionHelper.processTransactionFinancials({
          businessId,
          transactionDate,
          currencyCode: data.currency,
          items: data.items,
          customerId: data.customerId,
          globalDiscount: discount,
          txClient: tx
        });

        const grandTotal = financials.subtotal + financials.totalTax - discount;

        const quotation = await tx.quotation.create({
          data: {
            businessId,
            quoteNumber,
            title: data.title || null,
            customerId: data.customerId,
            contactId: data.contactId || null,
            dealId: data.dealId || null,
            assignedToId: data.assignedToId || null,
            status: "DRAFT",
            subtotal: financials.subtotal,
            tax: financials.totalTax,
            discount: discount,
            totalAmount: grandTotal,
            currency: data.currency || "INR",
            
            // Legacy Tax Projections
            cgst: financials.legacyTaxes.cgst,
            sgst: financials.legacyTaxes.sgst,
            igst: financials.legacyTaxes.igst,
            vatAmount: financials.legacyTaxes.vatAmount,
            vatType: data.taxType || data.vatType || null,
            
            // Engine Fields
            transactionCurrencyId: financials.currencyData.transactionCurrencyId,
            baseCurrencyId: financials.currencyData.baseCurrencyId,
            exchangeRate: financials.currencyData.exchangeRate,
            baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
            statutoryExchangeRate: financials.currencyData.statutoryRate,
            statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),

            termsConditions: data.termsConditions || null,
            issueDate: transactionDate,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
            notes: data.notes || null,
            items: {
              create: data.items.map(item => {
                const { warehouseId, productId, ...rest } = item;
                const payload = { ...rest };
                if (productId) payload.product = { connect: { id: productId } };
                return payload;
              })
            }
          },
          include: {
            items: true,
            customer: true
          }
        });

        // 3.5 Generate TaxLedger
        await TransactionHelper.saveTaxLedger(tx, businessId, "QUOTATION", quotation.id, financials.taxTransactions);

        // 4. Log Action & Notification
        await logAction(tx, {
          businessId,
          userId,
          userEmail,
          action: "QUOTATION_CREATED",
          entityType: "Quotation",
          entityId: quotation.id,
          details: { quoteNumber, totalAmount: pricing.totalAmount }
        });

        await triggerNotification(tx, {
          businessId,
          title: "New Quotation Created",
          message: `Quotation ${quoteNumber} of amount ${pricing.totalAmount} ${quotation.currency} has been drafted.`,
          type: "SUCCESS",
          entityType: "Quotation",
          entityId: quotation.id
        });

        return quotation;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        attempts++;
        if (attempts >= MAX_RETRIES) throw new Error("Could not generate a unique quotation number. Please try again.");
        continue;
      }
      throw error;
    }
  }
};

const updateQuotation = async (businessId, userId, userEmail, quotationId, data) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({
      where: { id: quotationId, businessId, isDeleted: false }
    });

    if (!existing) {
      throw new Error("Quotation not found");
    }

    if (["APPROVED", "ACCEPTED", "CANCELLED", "LOCKED", "INVOICED"].includes(existing.status)) {
      throw new Error(`Cannot modify a finalized transaction (Status: ${existing.status}).`);
    }

    let financials = null;
    let grandTotal = existing.totalAmount;
    let discount = existing.discount;

    // Trigger recalculation if any financial input changes: items, currency, discount, or date
    if (data.items || data.currency || data.discount !== undefined || data.issueDate) {
      discount = data.discount !== undefined ? Number(data.discount) : existing.discount;
      const transactionDate = data.issueDate ? new Date(data.issueDate) : existing.issueDate;
      const itemsToProcess = data.items || await tx.quotationItem.findMany({ where: { quotationId } });

      // Re-calculate pricing via Engine
      financials = await TransactionHelper.processTransactionFinancials({
        businessId,
        transactionDate,
        currencyCode: data.currency || existing.currency,
        items: itemsToProcess,
        customerId: data.customerId || existing.customerId,
        globalDiscount: discount,
        txClient: tx
      });
      
      grandTotal = financials.subtotal + financials.totalTax - discount;

      if (data.items) {
        // Delete old items if we are fully replacing them
        await tx.quotationItem.deleteMany({ where: { quotationId } });
      }
      
      // Always delete old tax ledger rows because we are regenerating them
      await tx.taxTransaction.deleteMany({
        where: { transactionId: quotationId, transactionType: "QUOTATION" }
      });
    }

    const updated = await tx.quotation.update({
      where: { id: quotationId },
      data: {
        title: data.title !== undefined ? data.title : existing.title,
        customerId: data.customerId || existing.customerId,
        contactId: data.contactId !== undefined ? data.contactId : existing.contactId,
        dealId: data.dealId !== undefined ? data.dealId : existing.dealId,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : existing.assignedToId,
        status: data.status || existing.status,
        subtotal: financials ? financials.subtotal : existing.subtotal,
        tax: financials ? financials.totalTax : existing.tax,
        discount: discount,
        totalAmount: grandTotal,
        currency: data.currency || existing.currency,
        
        // Legacy Tax Projections
        ...(financials ? {
          cgst: financials.legacyTaxes.cgst,
          sgst: financials.legacyTaxes.sgst,
          igst: financials.legacyTaxes.igst,
          vatAmount: financials.legacyTaxes.vatAmount
        } : {}),
        
        // Engine Fields
        ...(financials ? {
          transactionCurrencyId: financials.currencyData.transactionCurrencyId,
          baseCurrencyId: financials.currencyData.baseCurrencyId,
          exchangeRate: financials.currencyData.exchangeRate,
          baseCurrencyAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.exchangeRate, financials.currencyData.decimals),
          statutoryExchangeRate: financials.currencyData.statutoryRate,
          statutoryBaseAmount: CurrencyService.scaleAmount(grandTotal, financials.currencyData.statutoryRate, financials.currencyData.decimals),
        } : {}),

        vatType: data.taxType !== undefined ? data.taxType : (data.vatType !== undefined ? data.vatType : existing.vatType),
        termsConditions: data.termsConditions !== undefined ? data.termsConditions : existing.termsConditions,
        issueDate: data.issueDate ? new Date(data.issueDate) : existing.issueDate,
        expiryDate: data.expiryDate !== undefined ? (data.expiryDate ? new Date(data.expiryDate) : null) : existing.expiryDate,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        items: data.items ? {
          create: data.items.map(item => {
            const { warehouseId, productId, ...rest } = item;
            const payload = { ...rest };
            if (productId) payload.product = { connect: { id: productId } };
            return payload;
          })
        } : undefined
      },
      include: {
        items: true,
        customer: true
      }
    });

    if (financials) {
      await TransactionHelper.saveTaxLedger(tx, businessId, "QUOTATION", updated.id, financials.taxTransactions);
    }

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "QUOTATION_UPDATED",
      entityType: "Quotation",
      entityId: updated.id,
      details: { quoteNumber: updated.quoteNumber, changes: Object.keys(data) }
    });

    return updated;
  });
};

const getQuotationById = async (businessId, quotationId) => {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, businessId, isDeleted: false },
    include: {
      items: true,
      customer: true,
      contact: true,
      deal: true,
      payments: true,
      projects: true,
      assignedTo: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!quotation) {
    throw new Error("Quotation not found");
  }

  return quotation;
};

const deleteQuotation = async (businessId, userId, userEmail, quotationId) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({
      where: { id: quotationId, businessId, isDeleted: false }
    });

    if (!existing) {
      throw new Error("Quotation not found");
    }

    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "QUOTATION_DELETED",
      entityType: "Quotation",
      entityId: quotationId,
      details: { quoteNumber: existing.quoteNumber }
    });

    return true;
  });
};

const changeStatus = async (businessId, userId, userEmail, quotationId, status) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({
      where: { id: quotationId, businessId, isDeleted: false },
      include: { items: true } // Included to allow Project auto-detection
    });

    if (!existing) {
      throw new Error("Quotation not found");
    }

    const updated = await tx.quotation.update({
      where: { id: quotationId },
      data: { status }
    });



    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: "QUOTATION_STATUS_CHANGED",
      entityType: "Quotation",
      entityId: quotationId,
      details: { oldStatus: existing.status, newStatus: status, quoteNumber: existing.quoteNumber }
    });

    await triggerNotification(tx, {
      businessId,
      title: "Quotation Status Updated",
      message: `Quotation ${existing.quoteNumber} status changed to ${status}.`,
      type: status === "APPROVED" || status === "ACCEPTED" ? "SUCCESS" : "INFO",
      entityType: "Quotation",
      entityId: quotationId
    });

    return updated;
  });
};

module.exports = {
  createQuotation,
  updateQuotation,
  getQuotationById,
  deleteQuotation,
  changeStatus,
  generateDocNumber,
  calculatePricing
};
