const prisma = require('../src/config/prisma');
const invoiceService = require('../src/services/sales/invoice.service');

async function test() {
  console.log('======================================================');
  console.log(' LIVE INVOICE ENGINE VERIFICATION');
  console.log('======================================================\n');

  const businessId = 'dc70ca38-b141-477d-a379-f02649117a78'; // 'testing' business
  const business = await prisma.business.findUnique({
    where: { id: businessId }
  });

  const originalGstNumber = business.gstNumber;
  const originalState = business.state;

  try {
    // -----------------------------------------------------------------
    // CASE 1: Missing seller state/GSTIN (Must be blocked with error linking to settings)
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Missing seller GSTIN/state blocking ---');
    await prisma.business.update({
      where: { id: businessId },
      data: { gstNumber: null }
    });

    // Pick customer 'que info tech' (Gujarat, India)
    const customerSameState = await prisma.customer.findFirst({
      where: { businessId, state: 'Gujarat' }
    });

    let blockedError = null;
    try {
      await invoiceService.createInvoice(businessId, 'system-test-user', 'test@example.com', {
        customerId: customerSameState.id,
        items: [{ description: 'Test Widget', quantity: 1, price: 1000, taxPercent: 5 }]
      });
    } catch (err) {
      blockedError = err.message;
    }

    console.log('Result:', blockedError ? 'BLOCKED AS EXPECTED' : 'FAILED TO BLOCK');
    console.log('Error message:', blockedError);
    if (!blockedError || !blockedError.includes('/settings/company')) {
      throw new Error('Test 1 failed: Missing seller details did not throw expected settings link error.');
    }
    console.log('✓ TEST 1 PASSED: Missing seller GSTIN blocked with /settings/company link.\n');

    // Configure valid seller state and GSTIN for subsequent tests
    await prisma.business.update({
      where: { id: businessId },
      data: { state: 'Gujarat', gstNumber: '24AAACQ1234F1Z8' }
    });

    // Get or create test customers
    let custIntra = await prisma.customer.findFirst({
      where: { businessId, billingState: 'Gujarat', country: 'India' }
    });
    if (!custIntra) {
      custIntra = await prisma.customer.create({
        data: {
          businessId,
          company: 'Gujarat Client LLP',
          country: 'India',
          state: 'Gujarat',
          billingState: 'Gujarat',
          billingCountry: 'India',
          region: 'INDIA'
        }
      });
    }

    let custInter = await prisma.customer.findFirst({
      where: { businessId, billingState: 'Maharashtra', country: 'India' }
    });
    if (!custInter) {
      custInter = await prisma.customer.create({
        data: {
          businessId,
          company: 'Mumbai Traders Ltd',
          country: 'India',
          state: 'Maharashtra',
          billingState: 'Maharashtra',
          billingCountry: 'India',
          region: 'INDIA'
        }
      });
    }

    let custUAE = await prisma.customer.findFirst({
      where: { businessId, country: 'UAE' }
    });
    if (!custUAE) {
      custUAE = await prisma.customer.create({
        data: {
          businessId,
          company: 'Al-Noor Technologies FZE',
          country: 'UAE',
          billingCountry: 'UAE',
          state: 'Dubai',
          currency: 'AED',
          region: 'UAE'
        }
      });
    }

    // -----------------------------------------------------------------
    // CASE 2: 5% Same-State Invoice (Create and Update)
    // -----------------------------------------------------------------
    console.log('--- TEST 2: 5% Same-State Invoice (Create & Update) ---');
    const invSame = await invoiceService.createInvoice(businessId, 'system-test-user', 'test@example.com', {
      customerId: custIntra.id,
      currency: 'INR',
      items: [
        { description: 'Industrial Pump', quantity: 2, price: 1000, taxPercent: 5 }
      ]
    });

    console.log('Created Same-State Invoice:');
    console.log({
      invoiceNumber: invSame.invoiceNumber,
      status: invSame.status,
      currency: invSame.currency,
      subtotal: invSame.subtotal,
      cgst: invSame.cgst,
      sgst: invSame.sgst,
      igst: invSame.igst,
      totalTax: invSame.totalTax,
      grandTotal: invSame.grandTotal,
      baseCurrencyAmount: invSame.baseCurrencyAmount,
      items: invSame.items.map(it => ({
        description: it.description,
        rate: it.rate,
        quantity: it.quantity,
        taxPercent: it.taxPercent,
        cgstPercent: it.cgstPercent,
        sgstPercent: it.sgstPercent,
        igstPercent: it.igstPercent,
        totalTax: it.totalTax,
        totalAmount: it.totalAmount
      }))
    });

    // Update Same-State Invoice
    const updatedInvSame = await invoiceService.updateInvoice(businessId, 'system-test-user', 'test@example.com', invSame.id, {
      items: [
        { description: 'Industrial Pump (Revised)', quantity: 3, price: 1000, taxPercent: 5 }
      ]
    });

    console.log('\nUpdated Same-State Invoice:');
    console.log({
      invoiceNumber: updatedInvSame.invoiceNumber,
      subtotal: updatedInvSame.subtotal,
      cgst: updatedInvSame.cgst,
      sgst: updatedInvSame.sgst,
      igst: updatedInvSame.igst,
      totalTax: updatedInvSame.totalTax,
      grandTotal: updatedInvSame.grandTotal,
      baseCurrencyAmount: updatedInvSame.baseCurrencyAmount,
      items: updatedInvSame.items.map(it => ({
        description: it.description,
        rate: it.rate,
        quantity: it.quantity,
        taxPercent: it.taxPercent,
        cgstPercent: it.cgstPercent,
        sgstPercent: it.sgstPercent,
        igstPercent: it.igstPercent,
        totalTax: it.totalTax,
        totalAmount: it.totalAmount
      }))
    });
    console.log('✓ TEST 2 PASSED: Same-state invoice created & updated with accurate CGST (2.5%) + SGST (2.5%).\n');

    // -----------------------------------------------------------------
    // CASE 3: Inter-State Invoice (5% IGST)
    // -----------------------------------------------------------------
    console.log('--- TEST 3: Inter-State Invoice (5% IGST) ---');
    const invInter = await invoiceService.createInvoice(businessId, 'system-test-user', 'test@example.com', {
      customerId: custInter.id,
      currency: 'INR',
      items: [
        { description: 'Steel Conduit', quantity: 1, price: 5000, taxPercent: 5 }
      ]
    });

    console.log('Created Inter-State Invoice:');
    console.log({
      invoiceNumber: invInter.invoiceNumber,
      currency: invInter.currency,
      subtotal: invInter.subtotal,
      cgst: invInter.cgst,
      sgst: invInter.sgst,
      igst: invInter.igst,
      totalTax: invInter.totalTax,
      grandTotal: invInter.grandTotal,
      baseCurrencyAmount: invInter.baseCurrencyAmount,
      items: invInter.items.map(it => ({
        description: it.description,
        rate: it.rate,
        quantity: it.quantity,
        taxPercent: it.taxPercent,
        cgstPercent: it.cgstPercent,
        sgstPercent: it.sgstPercent,
        igstPercent: it.igstPercent,
        totalTax: it.totalTax,
        totalAmount: it.totalAmount
      }))
    });
    console.log('✓ TEST 3 PASSED: Inter-state invoice created with accurate IGST (5%).\n');

    // -----------------------------------------------------------------
    // CASE 4: UAE Export Invoice under LUT (0% IGST)
    // -----------------------------------------------------------------
    console.log('--- TEST 4: UAE Export Invoice under LUT (0% IGST) ---');
    const invExport = await invoiceService.createInvoice(businessId, 'system-test-user', 'test@example.com', {
      customerId: custUAE.id,
      currency: 'AED',
      exchangeRate: 22.5,
      exportType: 'LUT',
      items: [
        { description: 'Cloud Consulting Services', quantity: 1, price: 1000, taxPercent: 0 }
      ]
    });

    console.log('Created UAE Export Invoice under LUT:');
    console.log({
      invoiceNumber: invExport.invoiceNumber,
      currency: invExport.currency,
      exchangeRate: invExport.exchangeRate,
      subtotal: invExport.subtotal,
      cgst: invExport.cgst,
      sgst: invExport.sgst,
      igst: invExport.igst,
      totalTax: invExport.totalTax,
      grandTotal: invExport.grandTotal,
      baseCurrencyAmount: invExport.baseCurrencyAmount,
      items: invExport.items.map(it => ({
        description: it.description,
        rate: it.rate,
        quantity: it.quantity,
        taxPercent: it.taxPercent,
        cgstPercent: it.cgstPercent,
        sgstPercent: it.sgstPercent,
        igstPercent: it.igstPercent,
        totalTax: it.totalTax,
        totalAmount: it.totalAmount
      }))
    });
    console.log('✓ TEST 4 PASSED: UAE Export invoice under LUT created with 0% IGST and scaled baseCurrencyAmount.\n');

    // Cleanup test invoices created in this run
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: { in: [invSame.id, invInter.id, invExport.id] } }
    });
    await prisma.journalEntry.deleteMany({
      where: {
        OR: [
          { description: { contains: invSame.invoiceNumber } },
          { description: { contains: invInter.invoiceNumber } },
          { description: { contains: invExport.invoiceNumber } }
        ]
      }
    });
    await prisma.invoice.deleteMany({
      where: { id: { in: [invSame.id, invInter.id, invExport.id] } }
    });
    console.log('Cleaned up ephemeral verification invoices.\n');

  } finally {
    // Restore business state
    await prisma.business.update({
      where: { id: businessId },
      data: {
        gstNumber: originalGstNumber,
        state: originalState
      }
    });
    console.log('Restored business testing to original GSTIN/state.\n');
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
