const prisma = require("../config/prisma");
const { buildPrismaQuery, getPaginationMeta, logAudit } = require("../utils/crmHelper");
const { resolveGstState, resolveGstStateCode, validateGstinPrefix } = require("../services/tax/gstConfig");
const { 
  validateCustomerBank, 
  encryptAccountNumber, 
  maskAccountNumber,
  validateGstin,
  validateUaeTrn
} = require("../utils/bankValidation");

/**
 * Normalizes country strings and synchronizes region and addresses
 */
function normalizeCountryName(countryInput) {
  if (!countryInput) return 'INDIA';
  const c = String(countryInput).trim().toUpperCase();
  if (['IN', 'IND', 'INDIA'].includes(c)) return 'INDIA';
  if (['AE', 'ARE', 'UAE', 'UNITED ARAB EMIRATES'].includes(c)) return 'UAE';
  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(c)) return 'USA';
  if (['GB', 'GBR', 'UK', 'UNITED KINGDOM'].includes(c)) return 'UK';
  if (['CA', 'CAN', 'CANADA'].includes(c)) return 'CANADA';
  if (['AU', 'AUS', 'AUSTRALIA'].includes(c)) return 'AUSTRALIA';
  return c;
}

//////////////////////////////////////////////////////
// CREATE CRM ACCOUNT (UPGRADED CUSTOMER)
//////////////////////////////////////////////////////
exports.createCustomer = async (req, res) => {
  try {
    const {
      company,
      region,
      vatNumber,
      phone,
      website,
      group,
      currency,
      defaultLanguage = "SYSTEM",

      address,
      city,
      state,
      zipCode,
      country: inputCountry,

      billingStreet,
      billingCity,
      billingState,
      billingZipCode,
      billingCountry: inputBillingCountry,

      shippingStreet,
      shippingCity,
      shippingState,
      shippingZipCode,
      shippingCountry: inputShippingCountry,

      // New CRM Fields
      industry,
      annualRevenue,
      employeeCount,
      accountOwnerId,
      accountType,
      parentAccountId,
      linkedinUrl,
      facebookUrl,
      twitterUrl,
      tags,
      description,
      crmStatus = "ACTIVE",

      // Legacy / Single Bank Details
      bankName,
      accountName,
      accountNumber,
      swiftCode,
      iban,

      // Multi Bank Accounts Array
      bankAccounts
    } = req.body;

    //////////////////////////////////////////////////////
    // VALIDATIONS & SINGLE SOURCE OF TRUTH FOR COUNTRY
    //////////////////////////////////////////////////////
    if (!company) {
      return res.status(400).json({
        success: false,
        message: "company (Account Name) is required",
      });
    }

    // Country is the single source of truth:
    // Link or merge Region, Country, billing and shipping country so they never conflict
    const resolvedCountry = normalizeCountryName(inputCountry || region || "INDIA");
    const resolvedRegion = resolvedCountry;

    // Default Currency by Country if not provided
    let effectiveCurrency = currency;
    if (!effectiveCurrency || effectiveCurrency === 'SYSTEM') {
      if (resolvedCountry === 'INDIA') effectiveCurrency = 'INR';
      else if (resolvedCountry === 'UAE') effectiveCurrency = 'AED';
      else if (resolvedCountry === 'USA') effectiveCurrency = 'USD';
      else if (resolvedCountry === 'UK') effectiveCurrency = 'GBP';
      else if (resolvedCountry === 'CANADA') effectiveCurrency = 'CAD';
      else if (resolvedCountry === 'AUSTRALIA') effectiveCurrency = 'AUD';
      else effectiveCurrency = 'USD';
    }

    // Indian State Statutory Validation
    let resolvedState = state || billingState || shippingState || null;
    if (resolvedCountry === 'INDIA') {
      if (!resolvedState) {
        return res.status(400).json({
          success: false,
          message: "State is required for Indian customers under CBIC GST regulations."
        });
      }
      const stateObj = resolveGstState(resolvedState);
      if (!stateObj) {
        return res.status(400).json({
          success: false,
          message: `State "${resolvedState}" could not be resolved in the statutory Indian GST state master.`
        });
      }
      resolvedState = stateObj.name;
    }

    // Tax Number / GSTIN / TRN Validation
    if (vatNumber && String(vatNumber).trim()) {
      const cleanTaxNum = String(vatNumber).trim().toUpperCase();
      if (resolvedCountry === 'INDIA') {
        if (!validateGstin(cleanTaxNum)) {
          return res.status(400).json({
            success: false,
            message: `Invalid Indian GSTIN format (${cleanTaxNum}). Format: 2-digit state code + 10-char PAN + 1 entity digit + 'Z' + 1 checksum.`
          });
        }
        if (resolvedState) {
          const stateVal = validateGstinPrefix(cleanTaxNum, resolvedState);
          if (!stateVal.valid) {
            return res.status(400).json({
              success: false,
              message: stateVal.error
            });
          }
        }
      } else if (resolvedCountry === 'UAE') {
        if (!validateUaeTrn(cleanTaxNum)) {
          return res.status(400).json({
            success: false,
            message: `Invalid UAE TRN format (${cleanTaxNum}). Must be a 15-digit number starting with 100.`
          });
        }
      }
    }

    // Validate Account Owner (if provided)
    if (accountOwnerId) {
      const owner = await prisma.businessUser.findFirst({
        where: { id: accountOwnerId, businessId: req.business.id, isActive: true },
      });
      if (!owner) {
        return res.status(400).json({
          success: false,
          message: "Assigned account owner does not belong to this business or is inactive",
        });
      }
    }

    // Validate Parent Account (if provided)
    if (parentAccountId) {
      const parent = await prisma.customer.findFirst({
        where: { id: parentAccountId, businessId: req.business.id, isDeleted: false },
      });
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent account not found",
        });
      }
    }

    // Format tags
    let formattedTags = [];
    if (typeof tags === "string") {
      formattedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    } else if (Array.isArray(tags)) {
      formattedTags = tags;
    }

    // Validate and prepare Bank Accounts
    const validatedBankAccounts = [];
    if (Array.isArray(bankAccounts) && bankAccounts.length > 0) {
      for (const b of bankAccounts) {
        const valRes = validateCustomerBank(b, b.country || resolvedCountry);
        if (!valRes.valid) {
          return res.status(400).json({
            success: false,
            message: `Bank validation failed: ${valRes.errors.join(' ')}`
          });
        }
        const rawNum = String(b.accountNumber || b.accountNumberPlain || '').trim();
        validatedBankAccounts.push({
          businessId: req.business.id,
          accountHolderName: b.accountHolderName.trim(),
          bankName: b.bankName.trim(),
          accountNumberEncrypted: encryptAccountNumber(rawNum),
          accountNumberMasked: maskAccountNumber(rawNum),
          country: String(b.country || resolvedCountry).toUpperCase(),
          currency: b.currency || effectiveCurrency,
          ifsc: b.ifsc ? String(b.ifsc).toUpperCase().trim() : null,
          iban: b.iban ? String(b.iban).toUpperCase().replace(/\s/g, '') : null,
          swift: b.swift ? String(b.swift).toUpperCase().trim() : null,
          routingNumber: b.routingNumber ? String(b.routingNumber).trim() : null,
          branchName: b.branchName ? String(b.branchName).trim() : null,
          upiId: b.upiId ? String(b.upiId).trim() : null,
          sortCode: b.sortCode ? String(b.sortCode).replace(/[^0-9]/g, '') : null,
          transitNumber: b.transitNumber ? String(b.transitNumber).trim() : null,
          institutionNumber: b.institutionNumber ? String(b.institutionNumber).trim() : null,
          bsb: b.bsb ? String(b.bsb).replace(/[^0-9]/g, '') : null,
          isPrimary: Boolean(b.isPrimary)
        });
      }
    }

    //////////////////////////////////////////////////////
    // CREATE CRM ACCOUNT
    //////////////////////////////////////////////////////
    const customer = await prisma.customer.create({
      data: {
        businessId: req.business.id,
        company,
        region: resolvedRegion,
        country: resolvedCountry,
        vatNumber,
        phone,
        website,
        group,
        currency: effectiveCurrency,
        defaultLanguage,

        address,
        city,
        state: resolvedState,
        zipCode,

        billingStreet: billingStreet || address,
        billingCity: billingCity || city,
        billingState: billingState || resolvedState,
        billingZipCode: billingZipCode || zipCode,
        billingCountry: resolvedCountry,

        shippingStreet: shippingStreet || address,
        shippingCity: shippingCity || city,
        shippingState: shippingState || resolvedState,
        shippingZipCode: shippingZipCode || zipCode,
        shippingCountry: resolvedCountry,

        // Upgraded CRM Fields
        industry,
        annualRevenue: annualRevenue ? Number(annualRevenue) : null,
        employeeCount: employeeCount ? parseInt(employeeCount) : null,
        accountOwnerId: accountOwnerId || undefined,
        accountType: accountType || undefined,
        parentAccountId: parentAccountId || undefined,
        linkedinUrl,
        facebookUrl,
        twitterUrl,
        tags: formattedTags,
        description,
        crmStatus,

        // Legacy Bank Details
        bankName,
        accountName,
        accountNumber,
        swiftCode,
        iban,

        // Bank Accounts relation
        ...(validatedBankAccounts.length > 0 && {
          bankAccounts: {
            create: validatedBankAccounts
          }
        })
      },
      include: {
        bankAccounts: {
          select: {
            id: true,
            accountHolderName: true,
            bankName: true,
            accountNumberMasked: true,
            country: true,
            currency: true,
            ifsc: true,
            iban: true,
            swift: true,
            routingNumber: true,
            branchName: true,
            upiId: true,
            sortCode: true,
            transitNumber: true,
            institutionNumber: true,
            bsb: true,
            isPrimary: true,
            createdAt: true
          }
        }
      }
    });

    // Logging audit trail
    await logAudit(req.business.id, {
      userId: req.user.userId,
      action: "CREATE",
      moduleName: "CustomerAccount",
      recordId: customer.id,
      details: { company: customer.company, country: resolvedCountry },
    });

    res.status(201).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("createCustomer error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// GET ALL CRM ACCOUNTS
//////////////////////////////////////////////////////
exports.getCustomers = async (req, res) => {
  try {
    const { queryOptions, pagination } = buildPrismaQuery(req, {
      searchFields: ["company", "phone", "website", "vatNumber", "city", "country"],
      filterFields: {
        industry: "industry",
        crmStatus: "crmStatus",
        region: "region",
        country: "country",
        accountType: "accountType",
      },
      dateField: "createdAt",
    });

    queryOptions.where = {
      ...queryOptions.where,
      businessId: req.business.id,
      isDeleted: false,
    };

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where: queryOptions.where }),
      prisma.customer.findMany({
        ...queryOptions,
        include: {
          bankAccounts: {
            select: {
              id: true,
              accountHolderName: true,
              bankName: true,
              accountNumberMasked: true,
              country: true,
              currency: true,
              ifsc: true,
              iban: true,
              swift: true,
              isPrimary: true
            }
          }
        }
      }),
    ]);

    res.json({
      success: true,
      customers,
      pagination: getPaginationMeta(total, pagination.page, pagination.limit),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// GET CRM ACCOUNT BY ID
//////////////////////////////////////////////////////
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: req.business.id, isDeleted: false },
      include: {
        accountOwner: { select: { id: true, name: true, email: true } },
        parentAccount: { select: { id: true, company: true } },
        childAccounts: { select: { id: true, company: true } },
        customerContacts: { where: { isDeleted: false } },
        bankAccounts: {
          select: {
            id: true,
            accountHolderName: true,
            bankName: true,
            accountNumberMasked: true,
            country: true,
            currency: true,
            ifsc: true,
            iban: true,
            swift: true,
            routingNumber: true,
            branchName: true,
            upiId: true,
            sortCode: true,
            transitNumber: true,
            institutionNumber: true,
            bsb: true,
            isPrimary: true,
            createdAt: true
          }
        }
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    res.json({
      success: true,
      customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// UPDATE CRM ACCOUNT
//////////////////////////////////////////////////////
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      region,
      country: inputCountry,
      annualRevenue,
      employeeCount,
      accountOwnerId,
      parentAccountId,
      tags,
      accountType,
      bankAccounts,
      state: inputState,
      vatNumber,
      ...rest
    } = req.body;

    const existing = await prisma.customer.findFirst({
      where: { id, businessId: req.business.id, isDeleted: false },
      include: { bankAccounts: true }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const resolvedCountry = normalizeCountryName(inputCountry || region || existing.country || existing.region || 'INDIA');
    let resolvedState = inputState !== undefined ? inputState : existing.state;

    // Indian State Validation
    if (resolvedCountry === 'INDIA') {
      if (!resolvedState) {
        return res.status(400).json({
          success: false,
          message: "State is required for Indian customers under CBIC GST regulations."
        });
      }
      const stateObj = resolveGstState(resolvedState);
      if (!stateObj) {
        return res.status(400).json({
          success: false,
          message: `State "${resolvedState}" could not be resolved in the statutory Indian GST state master.`
        });
      }
      resolvedState = stateObj.name;
    }

    // Validate Tax Number if updating
    const taxNumToCheck = vatNumber !== undefined ? vatNumber : existing.vatNumber;
    if (taxNumToCheck && String(taxNumToCheck).trim()) {
      const cleanTax = String(taxNumToCheck).trim().toUpperCase();
      if (resolvedCountry === 'INDIA') {
        if (!validateGstin(cleanTax)) {
          return res.status(400).json({
            success: false,
            message: `Invalid Indian GSTIN format (${cleanTax}).`
          });
        }
        if (resolvedState) {
          const stateVal = validateGstinPrefix(cleanTax, resolvedState);
          if (!stateVal.valid) {
            return res.status(400).json({
              success: false,
              message: stateVal.error
            });
          }
        }
      } else if (resolvedCountry === 'UAE') {
        if (!validateUaeTrn(cleanTax)) {
          return res.status(400).json({
            success: false,
            message: `Invalid UAE TRN format (${cleanTax}).`
          });
        }
      }
    }

    // Validate Parent Account
    if (parentAccountId) {
      if (parentAccountId === id) {
        return res.status(400).json({
          success: false,
          message: "An account cannot be its own parent",
        });
      }
    }

    // Format tags
    let formattedTags = undefined;
    if (tags !== undefined) {
      if (typeof tags === "string") {
        formattedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      } else if (Array.isArray(tags)) {
        formattedTags = tags;
      }
    }

    // Update customer in transaction
    const customer = await prisma.$transaction(async (tx) => {
      // If bankAccounts array supplied, update/replace
      if (Array.isArray(bankAccounts)) {
        await tx.customerBankAccount.deleteMany({
          where: { customerId: id, businessId: req.business.id }
        });

        for (const b of bankAccounts) {
          const valRes = validateCustomerBank(b, b.country || resolvedCountry);
          if (!valRes.valid) {
            throw new Error(`Bank validation failed: ${valRes.errors.join(' ')}`);
          }
          const rawNum = String(b.accountNumber || b.accountNumberPlain || '').trim();
          await tx.customerBankAccount.create({
            data: {
              customerId: id,
              businessId: req.business.id,
              accountHolderName: b.accountHolderName.trim(),
              bankName: b.bankName.trim(),
              accountNumberEncrypted: encryptAccountNumber(rawNum),
              accountNumberMasked: maskAccountNumber(rawNum),
              country: String(b.country || resolvedCountry).toUpperCase(),
              currency: b.currency || 'USD',
              ifsc: b.ifsc ? String(b.ifsc).toUpperCase().trim() : null,
              iban: b.iban ? String(b.iban).toUpperCase().replace(/\s/g, '') : null,
              swift: b.swift ? String(b.swift).toUpperCase().trim() : null,
              routingNumber: b.routingNumber ? String(b.routingNumber).trim() : null,
              branchName: b.branchName ? String(b.branchName).trim() : null,
              upiId: b.upiId ? String(b.upiId).trim() : null,
              sortCode: b.sortCode ? String(b.sortCode).replace(/[^0-9]/g, '') : null,
              transitNumber: b.transitNumber ? String(b.transitNumber).trim() : null,
              institutionNumber: b.institutionNumber ? String(b.institutionNumber).trim() : null,
              bsb: b.bsb ? String(b.bsb).replace(/[^0-9]/g, '') : null,
              isPrimary: Boolean(b.isPrimary)
            }
          });
        }
      }

      return await tx.customer.update({
        where: { id },
        data: {
          ...rest,
          country: resolvedCountry,
          region: resolvedCountry,
          billingCountry: resolvedCountry,
          shippingCountry: resolvedCountry,
          state: resolvedState,
          billingState: resolvedState,
          shippingState: rest.shippingState || resolvedState,
          ...(vatNumber !== undefined && { vatNumber }),
          ...(annualRevenue !== undefined && { annualRevenue: annualRevenue ? Number(annualRevenue) : null }),
          ...(employeeCount !== undefined && { employeeCount: employeeCount ? parseInt(employeeCount) : null }),
          ...(formattedTags !== undefined && { tags: formattedTags }),
        },
        include: {
          bankAccounts: {
            select: {
              id: true,
              accountHolderName: true,
              bankName: true,
              accountNumberMasked: true,
              country: true,
              currency: true,
              ifsc: true,
              iban: true,
              swift: true,
              isPrimary: true
            }
          }
        }
      });
    });

    await logAudit(req.business.id, {
      userId: req.user.userId,
      action: "UPDATE",
      moduleName: "CustomerAccount",
      recordId: customer.id,
      details: { company: customer.company },
    });

    res.json({
      success: true,
      customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// DELETE CRM ACCOUNT
//////////////////////////////////////////////////////
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.customer.findFirst({
      where: { id, businessId: req.business.id, isDeleted: false },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    await prisma.customer.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await logAudit(req.business.id, {
      userId: req.user.userId,
      action: "DELETE",
      moduleName: "CustomerAccount",
      recordId: id,
    });

    res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// GET UNPAID INVOICES
//////////////////////////////////////////////////////
exports.getUnpaidInvoices = async (req, res) => {
  try {
    const { id } = req.params;

    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: id,
        businessId: req.business.id,
        isDeleted: false,
        status: { in: ["UNPAID", "PARTIAL_PAID", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        grandTotal: true,
        amountPaid: true,
        currency: true,
        dueDate: true,
        status: true,
        invoiceDate: true,
      },
    });

    res.json({
      success: true,
      invoices,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};