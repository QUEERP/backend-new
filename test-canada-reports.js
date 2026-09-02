const prisma = require('./src/config/prisma');
const taxProvisioning = require('./src/services/taxProvisioning.service');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');

async function testCanada() {
  try {
    const biz = await prisma.business.findFirst({
      where: { countryRef: { code: 'CA' } },
      include: { countryRef: true }
    });

    if (!biz) {
      console.log("No Canada business found.");
      return;
    }

    console.log(`Found Canada business: ${biz.name} (${biz.id})`);

    // 1. Re-provision Tax Rules to ensure Canada taxes are assigned
    console.log("\n--- Provisioning Tax Rules ---");
    const provRes = await taxProvisioning.provisionTaxRules(biz.id, 'CA');
    console.log(`Provisioned:`, provRes);
    
    // Also explicitly set the taxFrameworkId on the business
    const caFw = await prisma.taxFramework.findFirst({ where: { name: 'Canada GST/HST' } });
    if (caFw && biz.taxFrameworkId !== caFw.id) {
      await prisma.business.update({
        where: { id: biz.id },
        data: { taxFrameworkId: caFw.id }
      });
      console.log(`Updated business taxFrameworkId to: ${caFw.id}`);
    }

    // 2. Fetch Statutory Reports List
    console.log("\n--- Statutory Reports List ---");
    const reportsList = statutoryRegistry.getAvailableReports('Canada GST/HST');
    console.log(JSON.stringify(reportsList, null, 2));

    if (reportsList.length > 0) {
      console.log("\n--- Statutory Report Execution ---");
      const reportRes = await statutoryRegistry.generateReport('Canada GST/HST', reportsList[0].code, biz.id, {});
      console.log(JSON.stringify(reportRes, null, 2));
    }

    // 3. Tax Report (like what /api/reports/tax does)
    console.log("\n--- Tax Report Data ---");
    const taxTxns = await prisma.taxTransaction.findMany({
      where: { businessId: biz.id },
      include: {
        taxRate: { include: { taxType: true } }
      }
    });

    const taxData = taxTxns.map(t => ({
      transactionId: t.transactionId,
      type: t.transactionType,
      taxType: t.taxRate.taxType.name,
      rate: t.taxRate.rate,
      taxAmount: t.taxAmount,
      taxAmountBaseCcy: t.taxAmountBaseCcy,
      currency: t.transactionCurrencyId
    }));
    console.log(JSON.stringify(taxData, null, 2));

    // 4. Currency Report (from payments/invoices)
    console.log("\n--- Currency Report Data ---");
    const invoices = await prisma.invoice.findMany({
      where: { businessId: biz.id },
      include: { transactionCurrency: true, baseCurrency: true }
    });
    const bills = await prisma.bill.findMany({
      where: { businessId: biz.id },
      include: { transactionCurrency: true, baseCurrency: true }
    });

    const currencyMap = {};
    invoices.forEach(inv => {
      if (inv.transactionCurrency) {
        currencyMap[inv.transactionCurrency.code] = inv.exchangeRate || 1;
      }
    });
    bills.forEach(bill => {
      if (bill.transactionCurrency) {
        currencyMap[bill.transactionCurrency.code] = bill.exchangeRate || 1;
      }
    });

    console.log(JSON.stringify(currencyMap, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

testCanada();
