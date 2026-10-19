const prisma = require("../../config/prisma");
const { logAudit } = require("../../utils/crmHelper");

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

/**
 * Handles transactional, duplicate-safe conversion of a Lead into Customer (Account), Contact, and optional Deal.
 * Enforces business boundaries and logs the conversion history.
 */
exports.convertLead = async (businessId, userId, leadId, options = {}) => {
  const {
    createDeal = false,
    dealName,
    dealAmount,
    expectedCloseDate,
    dealStage = "New",
    campaignId,
    // Duplicate handling flags
    existingAccountId, // If passed, links contact/deal to this account instead of creating a new one
    existingContactId,  // If passed, links to this contact instead of creating a new one
    customerData = {}, // Customer fields from conversion form
  } = options;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch lead details
    const lead = await tx.lead.findFirst({
      where: { id: leadId, businessId, isDeleted: false },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    if (lead.status === "CONVERTED") {
      throw new Error("Lead has already been converted");
    }

    // 2. Duplicate Account Detection & Resolution
    let accountId = existingAccountId;
    const targetCompany = customerData.company || lead.company || lead.name;
    if (!accountId && targetCompany) {
      const duplicateAccount = await tx.customer.findFirst({
        where: {
          businessId,
          company: { equals: targetCompany, mode: "insensitive" },
          isDeleted: false,
        },
      });
      if (duplicateAccount) {
        // Automatically link to duplicate or resolve
        accountId = duplicateAccount.id;
        await tx.customer.update({
          where: { id: duplicateAccount.id },
          data: {
            isActive: true,
            isDeleted: false,
            ...(!duplicateAccount.leadId && { leadId: lead.id }),
          }
        }).catch(() => {});
      }
    }

    // 3. Create CRM Account (Customer) if no existing one was mapped or resolved
    let customer;
    if (!accountId) {
      const resolvedRegion = toPrismaRegion(customerData.region || customerData.country || lead.country || "INDIA");
      customer = await tx.customer.create({
        data: {
          businessId,
          company: targetCompany,
          phone: customerData.phone || lead.phone,
          website: customerData.website || lead.website,
          address: customerData.address || lead.city,
          city: customerData.city || lead.city,
          state: customerData.state || lead.state,
          country: customerData.country || lead.country,
          zipCode: customerData.zipCode || lead.zipCode,
          region: resolvedRegion,
          vatNumber: customerData.vatNumber,
          group: customerData.group,
          currency: customerData.currency || lead.currency || "SYSTEM",
          defaultLanguage: customerData.defaultLanguage || "SYSTEM",
          billingStreet: customerData.billingStreet,
          billingCity: customerData.billingCity,
          billingState: customerData.billingState,
          billingZipCode: customerData.billingZipCode,
          billingCountry: customerData.billingCountry,
          shippingStreet: customerData.shippingStreet,
          shippingCity: customerData.shippingCity,
          shippingState: customerData.shippingState,
          shippingZipCode: customerData.shippingZipCode,
          shippingCountry: customerData.shippingCountry,
          crmStatus: "PROSPECT",
          accountType: "PROSPECT",
          leadId: lead.id,
          isActive: true,
          isDeleted: false,
        },
      });
      accountId = customer.id;
    } else {
      customer = await tx.customer.findUnique({ where: { id: accountId } });
    }

    // 4. Duplicate Contact Detection & Resolution
    let contactId = existingContactId;
    if (!contactId && lead.email) {
      const duplicateContact = await tx.customerContact.findFirst({
        where: {
          businessId,
          email: { equals: lead.email, mode: "insensitive" },
          isDeleted: false,
        },
      });
      if (duplicateContact) {
        contactId = duplicateContact.id;
      }
    }

    // 5. Create Contact if not mapped
    let contact;
    if (!contactId) {
      contact = await tx.customerContact.create({
        data: {
          businessId,
          customerId: accountId,
          fullName: lead.name,
          email: lead.email,
          phone: lead.phone,
          position: lead.position,
          isPrimary: true, // Lead is the primary contact
        },
      });
      contactId = contact.id;
    } else {
      contact = await tx.customerContact.findUnique({ where: { id: contactId } });
    }

    // 6. Optional Deal Creation
    let deal = null;
    if (createDeal) {
      deal = await tx.deal.create({
        data: {
          businessId,
          name: dealName || `${customer.company} - Deal`,
          amount: Number(dealAmount) || lead.leadValue || 0,
          customerId: accountId,
          contactId: contactId,
          stage: dealStage,
          currency: customerData.currency || lead.currency || customer.currency || "SYSTEM",
          probability: 10, // Initial stage probability
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
          campaignId: campaignId || lead.campaignId,
          source: lead.source,
          assignedToId: lead.assignedToId,
        },
      });

      // Write Deal Stage History
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStage: "None",
          toStage: dealStage,
          changedById: lead.assignedToId,
        },
      });
    }

    // 7. Update Lead Status & Link to Customer
    await tx.lead.update({
      where: { id: leadId },
      data: {
        status: "CONVERTED",
        customerId: accountId,
      },
    });

    // 8. Create Conversion Log record
    const conversionLog = await tx.leadConversionLog.create({
      data: {
        businessId,
        leadId,
        customerId: accountId,
        contactId,
        dealId: deal ? deal.id : null,
        convertedById: lead.assignedToId,
      },
    });

    // 9. Reusable audit logger hook
    await logAudit(businessId, {
      userId,
      action: "CONVERT_LEAD",
      moduleName: "Lead",
      recordId: leadId,
      details: { accountId, contactId, dealId: deal?.id },
    });

    return {
      success: true,
      leadId,
      accountId,
      contactId,
      dealId: deal ? deal.id : null,
      conversionLogId: conversionLog.id,
    };
  });
};
