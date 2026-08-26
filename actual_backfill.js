const { PrismaClient } = require('@prisma/client');
const prisma = require('./src/config/prisma');

// Rounding helper
function roundAmount(amount, decimals = 2) {
  if (amount === null || amount === undefined) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

// Generalized backfill function
async function backfillModel(modelName, dateField, amountField, taxFields = []) {
  const currencies = await prisma.currency.findMany();
  const currencyMap = {};
  currencies.forEach(c => { currencyMap[c.code.toUpperCase()] = c; });

  const businesses = await prisma.business.findMany({ include: { baseCurrency: true } });
  const businessMap = {};
  businesses.forEach(b => { businessMap[b.id] = b; });

  const BATCH_SIZE = 100;
  let skip = 0;
  
  const results = {
    modelName,
    analyzed: 0,
    migrated: 0,
    untracked: 0,
    generatedTaxRowsCount: 0
  };

  while (true) {
    const batch = await prisma[modelName].findMany({
      skip: skip,
      take: BATCH_SIZE
    });

    if (batch.length === 0) break;

    for (const record of batch) {
      results.analyzed++;
      
      // IDEMPOTENCY CHECK: If already migrated, skip.
      if (record.transactionCurrencyId) {
        continue;
      }

      const business = businessMap[record.businessId];
      const legacyCurrencyStr = record.currency ? record.currency.toUpperCase().trim() : null;
      let mappedCurrency = legacyCurrencyStr ? currencyMap[legacyCurrencyStr] : null;

      let isLegacyUntracked = false;
      let finalExchangeRate = null;
      let finalBaseAmount = null;

      if (!business || !business.baseCurrencyId) {
        isLegacyUntracked = true;
      } else if (!mappedCurrency && legacyCurrencyStr) {
        isLegacyUntracked = true;
      } else if (!legacyCurrencyStr) {
         isLegacyUntracked = true;
      } else {
        if (mappedCurrency.id === business.baseCurrencyId) {
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
          }
        }
      }

      const baseDecimals = business?.baseCurrency?.decimals || 2;
      const roundedBaseAmount = finalBaseAmount !== null ? roundAmount(finalBaseAmount, baseDecimals) : null;

      if (isLegacyUntracked) {
        results.untracked++;
        // Write the reason flag
        await prisma[modelName].update({
          where: { id: record.id },
          data: { isLegacyUntracked: true }
        });
      } else {
        results.migrated++;
        
        // Prepare DB Update
        const updateData = {
          transactionCurrencyId: mappedCurrency.id,
          baseCurrencyId: business.baseCurrencyId,
          exchangeRate: finalExchangeRate,
          baseCurrencyAmount: roundedBaseAmount
        };
        
        await prisma[modelName].update({
          where: { id: record.id },
          data: updateData
        });

        // Generate TaxTransactions in DB
        const taxRate = await prisma.taxRate.findFirst();
        
        if (taxFields.length > 0 && taxRate) {
          for (const tf of taxFields) {
            if (record[tf.field] > 0) {
              const taxAmountTxn = record[tf.field];
              const taxAmountBase = finalExchangeRate ? taxAmountTxn * finalExchangeRate : null;
              
              await prisma.taxTransaction.create({
                data: {
                  businessId: business.id,
                  transactionType: modelName.toUpperCase(),
                  transactionId: record.id,
                  taxRateId: taxRate.id,
                  taxAmountTxnCcy: roundAmount(taxAmountTxn, mappedCurrency?.decimals || 2),
                  taxAmountBaseCcy: taxAmountBase !== null ? roundAmount(taxAmountBase, baseDecimals) : null
                }
              });
              results.generatedTaxRowsCount++;
            }
          }
        }
      }
    }
    skip += BATCH_SIZE;
  }
  return results;
}

async function main() {
  const runPhase = process.argv[2] || 'RUN1';
  
  // Ensure at least one TaxRate exists for the foreign key constraint
  const business = await prisma.business.findFirst();
  if (business) {
    const tf = await prisma.taxFramework.findFirst();
    if (tf) {
      const existingTaxRate = await prisma.taxRate.findFirst();
      if (!existingTaxRate) {
          const taxType = await prisma.taxType.findFirst();
          if (taxType) {
            await prisma.taxRate.create({
              data: { 
                name: 'Test Rate', 
                rate: 5, 
                taxTypeId: taxType.id,
                effectiveFrom: new Date(),
                taxRuleKey: 'TEST_RULE'
              }
            });
          }
      }
    }
  }

  const allResults = [];
  const models = [
    { name: 'invoice', date: 'invoiceDate', amount: 'grandTotal', taxes: [{field:'cgst', type:'CGST'}, {field:'sgst', type:'SGST'}, {field:'igst', type:'IGST'}, {field:'vatAmount', type:'VAT'}] },
    { name: 'bill', date: 'billDate', amount: 'totalAmount', taxes: [{field:'tax', type:'TAX'}] },
    { name: 'payment', date: 'paymentDate', amount: 'amount', taxes: [] }
  ];

  for (const modelDef of models) {
    try {
      const res = await backfillModel(modelDef.name, modelDef.date, modelDef.amount, modelDef.taxes);
      allResults.push(res);
    } catch (e) {
      console.log(`Failed to process model ${modelDef.name}: ${e.message}`);
    }
  }

  console.log(`\\n[${runPhase}] ACTUAL BACKFILL REPORT`);
  for (const res of allResults) {
    console.log(`Model: ${res.modelName.toUpperCase()} | Analyzed: ${res.analyzed} | Migrated (DB Updated): ${res.migrated} | Untracked (DB Updated): ${res.untracked} | Tax Rows Inserted: ${res.generatedTaxRowsCount}`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
