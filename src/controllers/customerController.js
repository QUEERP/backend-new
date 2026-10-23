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
  if (['AE', 'ARE', 'UAE', 'UNITED ARAB EMIRATES'].includes(c) || c.includes('EMIRATES')) return 'UAE';
  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(c) || c.includes('UNITED STATES')) return 'USA';
  if (['GB', 'GBR', 'UK', 'UNITED KINGDOM'].includes(c) || c.includes('KINGDOM')) return 'UK';
  if (['CA', 'CAN', 'CANADA'].includes(c)) return 'CANADA';
  if (['AU', 'AUS', 'AUSTRALIA'].includes(c)) return 'AUSTRALIA';
  return c;
}

const VALID_PRISMA_REGIONS = new Set([
  'INDIA', 'UAE', 'AFGHANISTAN', 'ALBANIA', 'ALGERIA', 'ARGENTINA', 'AUSTRALIA', 'AUSTRIA',
  'BAHRAIN', 'BANGLADESH', 'BELGIUM', 'BRAZIL', 'CANADA', 'CHILE', 'CHINA', 'COLOMBIA',
  'CROATIA', 'CZECH_REPUBLIC', 'DENMARK', 'EGYPT', 'ETHIOPIA', 'FINLAND', 'FRANCE', 'GERMANY',
  'GHANA', 'GREECE', 'HONG_KONG', 'HUNGARY', 'INDONESIA', 'IRAN', 'IRAQ', 'IRELAND', 'ISRAEL',
  'ITALY', 'JAPAN', 'JORDAN', 'KAZAKHSTAN', 'KENYA', 'KUWAIT', 'LEBANON', 'MALAYSIA', 'MEXICO',
  'MOROCCO', 'MYANMAR', 'NEPAL', 'NETHERLANDS', 'NEW_ZEALAND', 'NIGERIA', 'NORWAY', 'OMAN',
  'PAKISTAN', 'PHILIPPINES', 'POLAND', 'PORTUGAL', 'QATAR', 'ROMANIA', 'RUSSIA', 'SAUDI_ARABIA',
  'SINGAPORE', 'SOUTH_AFRICA', 'SOUTH_KOREA', 'SPAIN', 'SRI_LANKA', 'SWEDEN', 'SWITZERLAND',
  'TAIWAN', 'TANZANIA', 'THAILAND', 'TUNISIA', 'TURKEY', 'UKRAINE', 'UNITED_ARAB_EMIRATES',
  'UNITED_KINGDOM', 'UNITED_STATES', 'VENEZUELA', 'VIETNAM', 'ZIMBABWE', 'OTHER'
]);

/**
 * Maps country/region to a valid Prisma Region enum or falls back to 'OTHER'
 */
function toPrismaRegion(countryInput) {
  if (!countryInput) return 'INDIA';
  const c = String(countryInput).trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (VALID_PRISMA_REGIONS.has(c)) return c;
  if (['US', 'USA', 'UNITED_STATES', 'UNITED_STATES_OF_AMERICA'].includes(c)) return 'UNITED_STATES';
  if (['GB', 'GBR', 'UK', 'UNITED_KINGDOM', 'ENGLAND', 'GREAT_BRITAIN'].includes(c)) return 'UNITED_KINGDOM';
  if (['AE', 'ARE', 'UAE', 'UNITED_ARAB_EMIRATES'].includes(c)) return 'UAE';
  if (['IN', 'IND', 'INDIA'].includes(c)) return 'INDIA';
  if (['CA', 'CAN', 'CANADA'].includes(c)) return 'CANADA';
  if (['AU', 'AUS', 'AUSTRALIA'].includes(c)) return 'AUSTRALIA';
  return 'OTHER';
}

//////////////////////////////////////////////////////
// CREATE CRM ACCOUNT (UPGRADED CUSTOMER)
//////////////////////////////////////////////////////
exports.createCustomer = async (req, res) => {
  try {
    const {
      company,
      leadId,
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
    const resolvedRegion = toPrismaRegion(region || inputCountry || resolvedCountry);

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

    if (iban && /[^a-zA-Z0-9]/.test(String(iban).trim())) {
      return res.status(400).json({
        success: false,
        message: "IBAN cannot contain special characters or spaces."
      });
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
        const rawNum = String(b.accountNumber || b.accountNumberPlain || b.iban || b.swift || 'ACCOUNT').trim();
        validatedBankAccounts.push({
          businessId: req.business.id,
          accountHolderName: (b.accountHolderName || '').trim(),
          bankName: (b.bankName || '').trim(),
          accountNumberEncrypted: encryptAccountNumber(rawNum),
          accountNumberMasked: maskAccountNumber(rawNum),
          country: String(b.country || resolvedCountry).toUpperCase(),
          currency: b.currency || effectiveCurrency,
          ifsc: b.ifsc ? String(b.ifsc).toUpperCase().trim() : null,
          iban: b.iban ? String(b.iban).toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
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
    let customerLeadId = undefined;
    if (leadId) {
      const existingWithLead = await prisma.customer.findFirst({
        where: { leadId }
      });
      if (!existingWithLead) {
        customerLeadId = leadId;
      }
    }

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
        ...(customerLeadId ? { leadId: customerLeadId } : {}),

        address,
        city,
        state: resolvedState,
        zipCode,

        billingStreet: billingStreet || address,
        billingCity: billingCity || city,
        billingState: billingState !== undefined && billingState !== null && billingState !== '' ? billingState : resolvedState,
        billingZipCode: billingZipCode || zipCode,
        billingCountry: inputBillingCountry || resolvedCountry,

        shippingStreet: shippingStreet || billingStreet || address,
        shippingCity: shippingCity || billingCity || city,
        shippingState: shippingState !== undefined && shippingState !== null && shippingState !== '' ? shippingState : (billingState || resolvedState),
        shippingZipCode: shippingZipCode || billingZipCode || zipCode,
        shippingCountry: inputShippingCountry || inputBillingCountry || resolvedCountry,

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
        bankName: bankName || (validatedBankAccounts[0] ? validatedBankAccounts[0].bankName : null),
        accountName: accountName || (validatedBankAccounts[0] ? validatedBankAccounts[0].accountHolderName : null),
        accountNumber: accountNumber || (validatedBankAccounts[0] ? validatedBankAccounts[0].accountNumberMasked : null),
        swiftCode: swiftCode || (validatedBankAccounts[0] ? validatedBankAccounts[0].swift : null),
        iban: iban ? String(iban).toUpperCase().replace(/[^A-Z0-9]/g, '') : (validatedBankAccounts[0] ? validatedBankAccounts[0].iban : null),

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

    // If converted from a lead, link and mark lead as CONVERTED
    if (leadId) {
      try {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, businessId: req.business.id }
        });
        if (lead) {
          if (lead.name || lead.email) {
            await prisma.customerContact.create({
              data: {
                businessId: req.business.id,
                customerId: customer.id,
                fullName: lead.name,
                email: lead.email,
                phone: lead.phone,
                position: lead.position,
                isPrimary: true,
              }
            }).catch(() => {});
          }
          await prisma.lead.update({
            where: { id: leadId },
            data: {
              status: "CONVERTED",
              customerId: customer.id
            }
          });

          let bUserId = null;
          if (req.user?.userId) {
            const bUser = await prisma.businessUser.findFirst({
              where: { userId: req.user.userId, businessId: req.business.id }
            });
            if (bUser) bUserId = bUser.id;
          }

          await prisma.leadConversionLog.upsert({
            where: { leadId },
            update: {
              customerId: customer.id,
              ...(bUserId ? { convertedById: bUserId } : {}),
            },
            create: {
              businessId: req.business.id,
              leadId,
              customerId: customer.id,
              convertedById: bUserId,
            }
          }).catch((err) => console.error("Error upserting leadConversionLog in customerController:", err));
        }
      } catch (e) {
        console.error("Error linking lead to created customer:", e);
      }
    }

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

    if (rest.iban && /[^a-zA-Z0-9]/.test(String(rest.iban).trim())) {
      return res.status(400).json({
        success: false,
        message: "IBAN cannot contain special characters or spaces."
      });
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
          const rawNum = String(b.accountNumber || b.accountNumberPlain || b.iban || b.swift || 'ACCOUNT').trim();
          await tx.customerBankAccount.create({
            data: {
              customerId: id,
              businessId: req.business.id,
              accountHolderName: (b.accountHolderName || '').trim(),
              bankName: (b.bankName || '').trim(),
              accountNumberEncrypted: encryptAccountNumber(rawNum),
              accountNumberMasked: maskAccountNumber(rawNum),
              country: String(b.country || resolvedCountry).toUpperCase(),
              currency: b.currency || 'USD',
              ifsc: b.ifsc ? String(b.ifsc).toUpperCase().trim() : null,
              iban: b.iban ? String(b.iban).toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
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
          region: toPrismaRegion(rest.region || rest.country || resolvedCountry),
          billingCountry: rest.billingCountry || resolvedCountry,
          shippingCountry: rest.shippingCountry || rest.billingCountry || resolvedCountry,
          state: resolvedState,
          billingState: rest.billingState !== undefined ? rest.billingState : resolvedState,
          shippingState: rest.shippingState !== undefined ? rest.shippingState : (rest.billingState || resolvedState),
          ...(vatNumber !== undefined && { vatNumber }),
          ...(annualRevenue !== undefined && { annualRevenue: annualRevenue ? Number(annualRevenue) : null }),
          ...(employeeCount !== undefined && { employeeCount: employeeCount ? parseInt(employeeCount) : null }),
          ...(formattedTags !== undefined && { tags: formattedTags }),
          ...(rest.iban !== undefined && { iban: rest.iban ? String(rest.iban).toUpperCase().replace(/[^A-Z0-9]/g, '') : null }),
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