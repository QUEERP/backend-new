const { PrismaClient } = require('@prisma/client');
const prisma = require('./src/config/prisma');

// Rounding helper based on Currency.decimals
function roundAmount(amount, decimals = 2) {
  if (amount === null || amount === undefined) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

// Generalized backfill function
async function backfillModel(modelName, dateField, amountField, taxFields = []) {
  console.log(`\\n--- Processing Model: ${modelName} ---`);
  
  const currencies = await prisma.currency.findMany();
  const currencyMap = {};
  currencies.forEach(c => { currencyMap[c.code.toUpperCase()] = c; });

  const businesses = await prisma.business.findMany({ include: { baseCurrency: true } });
  const businessMap = {};
  businesses.forEach(b => { businessMap[b.id] = b; });

  const BATCH_SIZE = 100;
  let skip = 0;
  let totalProcessed = 0;
  let totalUntracked = 0;
  let totalMigrated = 0;
  
  const results = {
    modelName,
    analyzed: 0,
    migrated: 0,
    untracked: 0,
    sampleSuccess: [],
    sampleUntracked: []
  };

  while (true) {
    const batch = await prisma[modelName].findMany({
      skip: skip,
      take: BATCH_SIZE,
      // In a real run, we would add: where: { transactionCurrencyId: null } for idempotency.
      // We check idempotency in memory for this dry run report.
    });

    if (batch.length === 0) break;

    for (const record of batch) {
      results.analyzed++;
      
      // IDEMPOTENCY CHECK: If already migrated, skip.
      if (record.transactionCurrencyId) {
        continue; // Already processed
      }

      const business = businessMap[record.businessId];
      // Some models use 'currency', some might use 'currencyCode'. Assume 'currency'
      const legacyCurrencyStr = record.currency ? record.currency.toUpperCase().trim() : null;
      let mappedCurrency = legacyCurrencyStr ? currencyMap[legacyCurrencyStr] : null;

      let isLegacyUntracked = false;
      let reasonCode = null;
      let finalExchangeRate = null;
      let finalBaseAmount = null;
      const generatedTaxTxs = [];

      if (!business || !business.baseCurrencyId) {
        isLegacyUntracked = true;
        reasonCode = 'MISSING_BUSINESS_BASE_CURRENCY';
      } else if (!mappedCurrency && legacyCurrencyStr) {
        isLegacyUntracked = true;
        reasonCode = 'UNMAPPABLE_CURRENCY_STRING';
      } else if (!legacyCurrencyStr) {
         // No currency set at all on legacy record
         isLegacyUntracked = true;
         reasonCode = 'NO_LEGACY_CURRENCY_SET';
      } else if (mappedCurrency.id === business.baseCurrencyId) {
        finalExchangeRate = 1.0;
        finalBaseAmount = record[amountField]; 
      } else {
        const recordDate = record[dateField] || new Date();
        const historicalRate = await prisma.exchangeRate.findFirst({
          where: {
            fromCurrencyId: mappedCurrency.id,
            toCurrencyId: business.baseCurrencyId,
            effectiveDate: { lte: recordDate },
            rateType: 'COMMERCIAL'
          },
          orderBy: { effectiveDate: 'desc' }
        });

        if (historicalRate) {
          finalExchangeRate = historicalRate.rate;
          finalBaseAmount = record[amountField] * historicalRate.rate;
        } else {
          isLegacyUntracked = true;
          reasonCode = 'NO_HISTORICAL_RATE_FOUND';
        }
      }

      // Generate TaxTransactions
      const baseDecimals = business?.baseCurrency?.decimals || 2;
      
      if (!isLegacyUntracked && taxFields.length > 0) {
        taxFields.forEach(tf => {
          if (record[tf.field] > 0) {
            const taxAmountTxn = record[tf.field];
            const taxAmountBase = finalExchangeRate ? taxAmountTxn * finalExchangeRate : null;
            
            generatedTaxTxs.push({
              transactionType: modelName.toUpperCase(),
              transactionId: record.id,
              taxType: tf.type,
              taxAmountTxnCcy: roundAmount(taxAmountTxn, mappedCurrency?.decimals || 2),
              taxAmountBaseCcy: taxAmountBase !== null ? roundAmount(taxAmountBase, baseDecimals) : null
            });
          }
        });
      }

      // Format amounts with correct precision
      const roundedBaseAmount = finalBaseAmount !== null ? roundAmount(finalBaseAmount, baseDecimals) : null;

      if (isLegacyUntracked) {
        results.untracked++;
        if (results.sampleUntracked.length < 2) {
          results.sampleUntracked.push({
            id: record.id,
            legacyCurrency: legacyCurrencyStr,
            baseCurrencyCode: business?.baseCurrency?.code || 'UNKNOWN',
            reasonCode: reasonCode
          });
        }
      } else {
        results.migrated++;
        if (results.sampleSuccess.length < 3 || generatedTaxTxs.length > 0) {
          results.sampleSuccess.push({
            id: record.id,
            legacyCurrency: legacyCurrencyStr,
            baseCurrencyCode: business.baseCurrency.code,
            exchangeRate: finalExchangeRate,
            originalAmount: record[amountField],
            baseAmount: roundedBaseAmount,
            baseDecimalsApplied: baseDecimals,
            generatedTaxRows: generatedTaxTxs
          });
        }
      }
    }
    skip += BATCH_SIZE;
  }
  return results;
}

async function main() {
  console.log('Starting Generalized DRY RUN Backfill...\\n');
  
  const allResults = [];

  // Models to process. 
  // ModelName, DateField, AmountField, TaxFields (mapping legacy field to TaxType)
  const models = [
    { name: 'invoice', date: 'invoiceDate', amount: 'grandTotal', taxes: [{field:'cgst', type:'CGST'}, {field:'sgst', type:'SGST'}, {field:'igst', type:'IGST'}, {field:'vatAmount', type:'VAT'}] },
    { name: 'bill', date: 'billDate', amount: 'grandTotal', taxes: [{field:'cgst', type:'CGST'}, {field:'sgst', type:'SGST'}, {field:'igst', type:'IGST'}, {field:'vatAmount', type:'VAT'}] },
    { name: 'payment', date: 'paymentDate', amount: 'amount', taxes: [] },
    // Add other models similarly... CRM models like customer just have a currency string and no amount/taxes.
    { name: 'customer', date: 'createdAt', amount: null, taxes: [] }, 
    { name: 'vendor', date: 'createdAt', amount: null, taxes: [] }
  ];

  for (const modelDef of models) {
    try {
      const res = await backfillModel(modelDef.name, modelDef.date, modelDef.amount, modelDef.taxes);
      allResults.push(res);
    } catch (e) {
      console.log(`Failed to process model ${modelDef.name}: ${e.message}`);
    }
  }

  console.log('\\n=========================================');
  console.log('         GENERALIZED DRY RUN REPORT      ');
  console.log('=========================================\\n');

  for (const res of allResults) {
    console.log(`--- Model: ${res.modelName.toUpperCase()} ---`);
    console.log(`Analyzed: ${res.analyzed} | Migrated: ${res.migrated} | Untracked: ${res.untracked}`);
    if (res.sampleSuccess.length > 0) {
      console.log(`\\n[Success Sample]`);
      console.log(JSON.stringify(res.sampleSuccess, null, 2));
    }
    if (res.sampleUntracked.length > 0) {
      console.log(`\\n[Untracked Sample]`);
      console.log(JSON.stringify(res.sampleUntracked, null, 2));
    }
    console.log('\\n-----------------------------------------');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
