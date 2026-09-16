const prisma = require('./src/config/prisma');
const TransactionHelper = require('./src/services/TransactionHelper');

async function test() {
  const biz = await prisma.business.findFirst({ where: { countryCode: 'MX' } });
  const cust = await prisma.customer.findFirst({ where: { businessId: biz.id, country: 'MX' } });
  const p1 = await prisma.product.findFirst({ where: { businessId: biz.id } });
  
  const res = await TransactionHelper.processTransactionFinancials({
    businessId: biz.id,
    transactionDate: new Date(),
    currencyCode: 'CAD',
    items: [{ productId: p1.id, quantity: 1, price: 1000, description: 'Test Goods' }],
    customerId: cust.id,
    globalDiscount: 0,
    txClient: prisma,
    userId: biz.ownerId
  });
  
  console.log(JSON.stringify(res, null, 2));
}

test().finally(() => prisma.$disconnect());
