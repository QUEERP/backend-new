const prisma = require('./src/config/prisma');

async function fixOldRecords() {
  try {
    const items = await prisma.quotationItem.findMany({
      where: { warehouseId: null }
    });
    
    console.log(`Found ${items.length} items with null warehouse.`);
    
    let updated = 0;
    for (const item of items) {
      // Find the quotation to get the businessId
      const quotation = await prisma.quotation.findUnique({
        where: { id: item.quotationId }
      });
      
      if (!quotation) continue;

      // Find the first available warehouse for this business
      const warehouse = await prisma.warehouse.findFirst({
        where: { businessId: quotation.businessId }
      });
      
      if (warehouse) {
        await prisma.quotationItem.update({
          where: { id: item.id },
          data: { warehouseId: warehouse.id }
        });
        updated++;
      }
    }
    console.log(`Updated ${updated} items.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOldRecords();
