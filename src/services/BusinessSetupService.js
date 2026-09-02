const prisma = require("../config/prisma");
const { getCountryData } = require("../utils/countryHelper");
const { provisionTaxRules } = require('./taxProvisioning.service');

class BusinessSetupService {
  async setupNewBusiness(name, country, businessType, userId) {
    const countryInfo = getCountryData(country); // country is now CCA2 code like 'IN', 'AE'
    
    // Fallback if country info not found
    const countryCode = countryInfo ? countryInfo.code : 'IN';
    const currencyCode = countryInfo ? countryInfo.currencyCode : 'INR';
    const currencySymbol = countryInfo ? countryInfo.currencySymbol : '₹';
    const taxType = countryInfo ? countryInfo.taxType : 'INDIA_GST';
    
    const isIndia = countryCode === 'IN';
    const isUAE = countryCode === 'AE';
    const invoicePrefix = isIndia ? 'INV-IND-' : (isUAE ? 'INV-UAE-' : 'INV-');
    
    // Default Finance Accounts based on Country
    const defaultAccounts = isIndia ? [
      { name: "CGST Payable", type: "LIABILITY", code: "L-101" },
      { name: "SGST Payable", type: "LIABILITY", code: "L-102" },
      { name: "IGST Payable", type: "LIABILITY", code: "L-103" },
      { name: "Sales Revenue", type: "INCOME", code: "I-201" },
      { name: "Cost of Goods Sold", type: "EXPENSE", code: "E-301" }
    ] : (isUAE ? [
      { name: "VAT Payable", type: "LIABILITY", code: "L-101" },
      { name: "VAT Receivable", type: "ASSET", code: "A-102" },
      { name: "Sales Revenue", type: "INCOME", code: "I-201" },
      { name: "Cost of Goods Sold", type: "EXPENSE", code: "E-301" }
    ] : []);

    // Resolve new relational fields: countryId, baseCurrencyId, taxFrameworkId
    const countryRecord = await prisma.country.upsert({
      where: { code: countryCode },
      update: {},
      create: { code: countryCode, name: countryInfo?.name || countryCode }
    });
    const currencyRecord = await prisma.currency.upsert({
      where: { code: currencyCode },
      update: {},
      create: { code: currencyCode, name: currencyCode, symbol: currencySymbol || currencyCode, decimalPrecision: 2 }
    });
    // TaxFramework is optional — only link if seeded for this country.
    // TaxFramework.countryId is a plain scalar String (no relation object),
    // so we resolve via countryRecord.id (already upserted above).
    const taxFrameworkRecord = await prisma.taxFramework.findFirst({
      where: { countryId: countryRecord.id }
    });

    const business = await prisma.$transaction(async (tx) => {
      // 1. Create Business
      const newBusiness = await tx.business.create({
        data: {
          name,
          countryCode: countryCode,
          currencyCode: currencyCode,
          currencySymbol: currencySymbol,
          taxType: taxType,
          currency: currencyCode, // Keeping old field populated to prevent immediate breakages
          businessType: businessType || "Trading",
          ownerId: userId,
          isActive: false,
          // New relational fields — enable TaxEngine, CurrencyService, and TaxProvisioning
          countryId: countryRecord.id,
          baseCurrencyId: currencyRecord.id,
          taxFrameworkId: taxFrameworkRecord?.id || null,
        }
      });

      // 2. Create Subscription
      await tx.subscription.create({
        data: {
          businessId: newBusiness.id,
          status: "ACTIVE" // Assuming active to let them configure it immediately
        }
      });

      // 3. Create Settings
      await tx.settings.create({
        data: {
          businessId: newBusiness.id,
          companyName: name,
          currency: currencyCode,
          currencySymbol,
          invoicePrefix,
          invoiceFormat: "INV-YYYY-MM-DD-COUNT",
          defaultWarehouseId: null, // Will update below
          invoiceTemplate: isIndia ? "india_gst_modern" : "uae_vat_modern"
        }
      });

      // 4. Roles & Permissions
      const adminRole = await tx.role.create({ data: { name: "Admin", businessId: newBusiness.id } });
      await tx.role.create({ data: { name: "Manager", businessId: newBusiness.id } });
      await tx.role.create({ data: { name: "Accountant", businessId: newBusiness.id } });
      await tx.role.create({ data: { name: "User", businessId: newBusiness.id } });
      await tx.role.create({ data: { name: "Viewer", businessId: newBusiness.id } });
      
      const permissions = await tx.permission.findMany();
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map(p => ({ roleId: adminRole.id, permissionId: p.id }))
        });
      }

      await tx.businessUser.create({
        data: { userId, businessId: newBusiness.id, roleId: adminRole.id }
      });

      // 5. Default Warehouse
      const mainWarehouse = await tx.warehouse.create({
        data: {
          name: "Main Warehouse",
          code: "WH-MAIN",
          businessId: newBusiness.id,
          type: "STANDARD"
        }
      });
      await tx.settings.update({
        where: { businessId: newBusiness.id },
        data: { defaultWarehouseId: mainWarehouse.id }
      });

      // 6. Default Accounts
      if (defaultAccounts.length > 0) {
        await tx.account.createMany({
          data: defaultAccounts.map(a => ({ ...a, businessId: newBusiness.id }))
        });
      }

      // Update User Active Business
      await tx.user.update({
        where: { id: userId },
        data: { activeBusinessId: newBusiness.id }
      });

      return newBusiness;
    }, { timeout: 20000 });

    // 7. Initialize Compliance Rules (outside transaction to avoid deadlocks with existing engine)
    const complianceEngine = require('./compliance/ComplianceEngine');
    // Note: in a real implementation, we would register country-specific rules here
    
    // Setup Country Specific Tax Configuration
    await this.setupCountryCompliance(business.id, country);

    return business;
  }

  async setupCountryCompliance(businessId, countryCode) {
    const isIndia = countryCode === 'IN';
    const isUAE = countryCode === 'AE';

    // 1. Compliance rules (field validation reminders)
    const rulesToCreate = [];

    if (isIndia) {
      rulesToCreate.push({
        businessId,
        modelName: 'Business',
        fieldName: 'gstNumber',
        ruleType: 'REQUIRED',
        severity: 'HIGH',
        description: 'GST Number is required for Indian Business. Please configure it in Settings.'
      });
      rulesToCreate.push({
        businessId,
        modelName: 'Business',
        fieldName: 'financialYearStart',
        ruleType: 'REQUIRED',
        severity: 'HIGH',
        description: 'Financial Year Start is required. Please configure it in Settings.'
      });
    }

    if (isUAE) {
      rulesToCreate.push({
        businessId,
        modelName: 'Settings',
        fieldName: 'trn',
        ruleType: 'REQUIRED',
        severity: 'HIGH',
        description: 'TRN is required for UAE Business. Please configure it in Settings.'
      });
    }

    for (const ruleData of rulesToCreate) {
      const existingRule = await prisma.complianceRule.findFirst({
        where: { businessId, fieldName: ruleData.fieldName, modelName: ruleData.modelName }
      });
      if (!existingRule) {
        await prisma.complianceRule.create({
          data: { ...ruleData, isActive: true }
        });
      }
    }

    // 2. Auto-provision TaxRule rows for this business based on its country
    //    This makes the TaxEngine work immediately without manual configuration.
    //    Countries without a manifest are skipped with a warning (not an error).
    try {
      await provisionTaxRules(businessId, countryCode);
    } catch (err) {
      // Log but don't fail business creation — a missing framework is a data gap,
      // not a reason to block the business from being created.
      console.error(`[BusinessSetup] TaxProvisioning failed for ${countryCode}: ${err.message}`);
    }
  }
}

module.exports = new BusinessSetupService();
