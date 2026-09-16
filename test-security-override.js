const prisma = require('./src/config/prisma');
const TransactionHelper = require('./src/services/TransactionHelper');

async function run() {
  console.log('--- Running Security Regression Test for Manual Overrides ---');
  let tx = null;
  
  try {
    const owner = await prisma.user.findFirst();
    const business = await prisma.business.create({
      data: {
        name: 'Security Test Biz',
        countryCode: 'AE',
        baseCurrency: { connect: { code: 'AED' } },
        owner: { connect: { id: owner.id } }
      }
    });
    
    let customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        company: 'Security Test Inc.',
        country: 'AE',
        region: 'UNITED_KINGDOM'
      }
    });

    console.log('Testing override WITHOUT userId (should fail)...');
    try {
      await TransactionHelper.processTransactionFinancials({
        businessId: business.id,
        transactionDate: new Date(),
        currencyCode: 'AED',
        customerId: customer.id,
        items: [
          {
            itemSubtotal: 1000,
            isManualOverride: true,
            overrideTaxRate: 0,
            manualOverrideReason: 'Testing security bypass'
          }
        ]
        // Explicitly omitting userId!
      });
      console.log('❌ FAIL: Security regression! Override succeeded without a userId.');
      process.exit(1);
    } catch (e) {
      if (e.message.includes('userId is required to process manual tax overrides')) {
        console.log('✅ PASS: System correctly blocked manual override without userId.');
      } else {
        console.log(`❌ FAIL: Unexpected error message: ${e.message}`);
        process.exit(1);
      }
    }
    
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
