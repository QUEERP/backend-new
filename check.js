const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adjs = await prisma.stockAdjustment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { items: true }
  });
  console.log("Latest Adjustment:", JSON.stringify(adjs, null, 2));

  if (adjs.length > 0 && adjs[0].items.length > 0) {
    const item = adjs[0].items[0];
    const stock = await prisma.stock.findMany({
      where: { productId: item.productId }
    });
    console.log("Stock for product:", JSON.stringify(stock, null, 2));
    
    const product = await prisma.product.findUnique({
      where: { id: item.productId }
    });
    console.log("Product details:", JSON.stringify(product, null, 2));
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
