const prisma = require('./src/config/prisma');

async function fixCurrencies() {
  const businesses = await prisma.business.findMany();
  
  for (const business of businesses) {
    const defaultCurrency = business.currency || 'INR';
    
    let symbol = '₹';
    if (defaultCurrency === 'USD') symbol = '$';
    if (defaultCurrency === 'EUR') symbol = '€';
    if (defaultCurrency === 'GBP') symbol = '£';
    if (defaultCurrency === 'AED') symbol = 'د.إ';
    
    await prisma.purchaseOrder.updateMany({
      where: {
        businessId: business.id,
        currencyCode: 'AED'
      },
      data: {
        currencyCode: defaultCurrency,
        currencySymbol: symbol
      }
    });
    console.log(`Updated POs for business ${business.id} to ${defaultCurrency}`);
  }
}

fixCurrencies().then(() => process.exit(0)).catch(console.error);
