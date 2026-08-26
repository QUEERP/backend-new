const { PrismaClient } = require('@prisma/client');
const prisma = require('./src/config/prisma');

async function main() {
  console.log('Starting DRY RUN Backfill...');

  const currencies = await prisma.currency.findMany();
  const currencyMap = {};
  currencies.forEach(c => {
    currencyMap[c.code.toUpperCase()] = c;
  });

  const businesses = await prisma.business.findMany({
    include: { baseCurrency: true }
  });
  const businessMap = {};
  businesses.forEach(b => {
    businessMap[b.id] = b;
  });

  let totalProcessed = 0;
  let totalUntracked = 0;
  const flaggedSample = [];
  const successSample = [];

  const invoices = await prisma.invoice.findMany({
    take: 1000
  });

  for (const inv of invoices) {
    totalProcessed++;
    const business = businessMap[inv.businessId];
    
    const legacyCurrencyStr = inv.currency ? inv.currency.toUpperCase().trim() : null;
    let mappedCurrency = legacyCurrencyStr ? currencyMap[legacyCurrencyStr] : null;
    
    let isLegacyUntracked = false;
    let finalExchangeRate = null;
    let finalBaseAmount = null;
    let reasonCode = null;
    const generatedTaxTxs = [];

    if (!business || !business.baseCurrencyId) {
      isLegacyUntracked = true;
      reasonCode = 'MISSING_BUSINESS_BASE_CURRENCY';
    } else if (!mappedCurrency) {
      isLegacyUntracked = true;
      reasonCode = 'UNMAPPABLE_CURRENCY_STRING';
    } else if (mappedCurrency.id === business.baseCurrencyId) {
      finalExchangeRate = 1.0;
      finalBaseAmount = inv.grandTotal; 
    } else {
      const historicalRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrencyId: mappedCurrency.id,
          toCurrencyId: business.baseCurrencyId,
          effectiveDate: { lte: inv.invoiceDate },
          rateType: 'COMMERCIAL'
        },
        orderBy: { effectiveDate: 'desc' }
      });

      if (historicalRate) {
        finalExchangeRate = historicalRate.rate;
        finalBaseAmount = inv.grandTotal * historicalRate.rate;
      } else {
        isLegacyUntracked = true;
        reasonCode = 'NO_HISTORICAL_RATE_FOUND';
      }
    }

    if (inv.cgst || inv.sgst || inv.igst || inv.vatAmount) {
      const taxes = [
        { type: 'CGST', amount: inv.cgst },
        { type: 'SGST', amount: inv.sgst },
        { type: 'IGST', amount: inv.igst },
        { type: 'VAT', amount: inv.vatAmount }
      ].filter(t => t.amount > 0);

      taxes.forEach(t => {
        generatedTaxTxs.push({
          transactionType: 'INVOICE',
          transactionId: inv.id,
          taxType: t.type,
          taxAmountTxnCcy: t.amount,
          taxAmountBaseCcy: finalExchangeRate ? t.amount * finalExchangeRate : null,
        });
      });
    }

    if (isLegacyUntracked) {
      totalUntracked++;
      if (flaggedSample.length < 5) {
        flaggedSample.push({
          id: inv.id,
          legacyCurrency: legacyCurrencyStr,
          baseCurrencyCode: business?.baseCurrency?.code || 'UNKNOWN',
          date: inv.invoiceDate,
          reasonCode: reasonCode
        });
      }
    } else {
      if (successSample.length < 10) {
        successSample.push({
          id: inv.id,
          legacyCurrency: legacyCurrencyStr,
          baseCurrencyCode: business.baseCurrency.code,
          exchangeRate: finalExchangeRate,
          originalAmount: inv.grandTotal,
          baseAmount: finalBaseAmount,
          generatedTaxRows: generatedTaxTxs
        });
      }
    }
  }

  console.log('\\n--- DRY RUN RESULTS ---');
  console.log(`Total Invoices Analyzed: ${totalProcessed}`);
  console.log(`isLegacyUntracked Count: ${totalUntracked} (${((totalUntracked/totalProcessed)*100).toFixed(2)}%)`);
  
  console.log('\\n--- FLAGGED SAMPLE (isLegacyUntracked = true) ---');
  console.log(JSON.stringify(flaggedSample, null, 2));

  console.log('\\n--- SUCCESS SAMPLE ---');
  console.log(JSON.stringify(successSample, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
