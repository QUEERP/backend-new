const p = require('./src/config/prisma');

async function main() {
  await p.invoice.updateMany({data: {transactionCurrencyId: null, baseCurrencyId: null, exchangeRate: null, baseCurrencyAmount: null, isLegacyUntracked: false}});
  await p.bill.updateMany({data: {transactionCurrencyId: null, baseCurrencyId: null, exchangeRate: null, baseCurrencyAmount: null, isLegacyUntracked: false}});
  await p.payment.updateMany({data: {transactionCurrencyId: null, baseCurrencyId: null, exchangeRate: null, baseCurrencyAmount: null, isLegacyUntracked: false}});
  await p.taxTransaction.deleteMany();
  
  let tt = await p.taxType.findFirst();
  if(!tt) {
    tt = await p.taxType.create({data: {name: 'TEST_TYPE', taxClass: 'GOODS'}});
  }
}

main().finally(() => p.$disconnect());
