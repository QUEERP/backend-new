const prisma = require('./src/config/prisma');
const TransactionHelper = require('./src/services/TransactionHelper');

async function testCanadaOverride() {
  try {
    let biz = await prisma.business.findFirst({
      where: { countryRef: { code: 'CA' } }
    });

    if (!biz) {
      console.log("No Canada business found. Creating one...");
      const caCountry = await prisma.country.findUnique({ where: { code: 'CA' } });
      const cadCurrency = await prisma.currency.findUnique({ where: { code: 'CAD' } });
      const caFw = await prisma.taxFramework.findFirst({ where: { name: 'Canada GST/HST' } });
      biz = await prisma.business.create({
        data: {
          name: 'Canada Test Biz',
          countryCode: 'CA',
          countryCode: 'CA',
          countryRef: { connect: { id: caCountry?.id } },
          taxFramework: { connect: { id: caFw?.id } },
          baseCurrency: { connect: { id: cadCurrency?.id } },
          owner: {
            create: {
              name: 'Owner CA',
              email: `owner_${Date.now()}@ca.test`,
              password: '123',
              role: 'ADMIN'
            }
          }
        }
      });
    }

    console.log(`Found/Created Canada business: ${biz.name} (${biz.id})`);

    const taxType = await prisma.taxType.findFirst({ where: { name: 'GST', taxFramework: { name: 'Canada GST/HST' } } });
    const user = await prisma.user.findFirst({ where: { email: { contains: 'ca.test' } } });
    if (!user) { throw new Error('User not found'); }

    // Mock TaxResolver to avoid needing full DB provisioning just for the override test
    const TaxResolver = require('./src/services/TaxResolver');
    TaxResolver.resolveTaxRule = async () => ({ id: 'mock-rule', name: 'Mock CA Rule', taxRuleId: 'mock-rule', taxRateId: 'mock-rate' });

    const vendor = await prisma.vendor.create({
      data: { businessId: biz.id, name: 'CA Override Vendor', country: 'CA' }
    });
    const product = await prisma.product.create({
      data: { name: 'CA Goods', type: 'GOODS', sku: `CA-OVR-${Date.now()}`, price: 100, costPrice: 50, businessId: biz.id }
    });

    // We will simulate the raw payload exactly as the API would receive it
    const billItems = [{
        productId: product.id,
        quantity: 1,
        price: 100,
        isManualOverride: true,
        overrideTaxRate: 10,
        overrideReason: "Canada specific override reason",
        overrideTaxTypeId: taxType.id
    }];

    // Also, temporarily grant permission to the user so TransactionHelper doesn't fail
    // But since the user doesn't have it, let's just pass userId: null for now, 
    // OR create the role. Wait, the user asked to verify overriddenBy in production flow.
    // If we pass userId: null, the test passes? 
    // Let's pass userId: user.id and skip the permission check if it's too complex to seed here,
    // actually let's seed the permission!
    
    // Create Role, Module and Permission
    const mod = await prisma.module.upsert({
        where: { name: 'Tax' },
        update: {},
        create: { name: 'Tax' }
    });
    
    // We need the unique constraint fields for permission upsert
    // Which are moduleId and action
    const perm = await prisma.permission.upsert({
        where: { moduleId_action: { moduleId: mod.id, action: 'TAX_OVERRIDE' } },
        update: {},
        create: { action: 'TAX_OVERRIDE', moduleId: mod.id }
    });
    const role = await prisma.role.create({
        data: { name: `TAX_ADMIN_${Date.now()}`, businessId: biz.id, rolePermissions: { create: { permissionId: perm.id } } }
    });
    await prisma.businessUser.upsert({
        where: { userId_businessId: { userId: user.id, businessId: biz.id } },
        update: { roleId: role.id },
        create: { userId: user.id, businessId: biz.id, roleId: role.id }
    });

    const financialResult = await TransactionHelper.processTransactionFinancials({
        businessId: biz.id,
        transactionDate: new Date(),
        currencyCode: 'CAD',
        items: billItems,
        vendorId: vendor.id,
        transactionType: 'BILL',
        userId: user.id 
    });

    console.log("Canada Override Test Result:");
    console.dir(financialResult.taxTransactions, { depth: null });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

testCanadaOverride();
