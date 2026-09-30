const prisma = require('./src/config/prisma.js');

async function mergeStock() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stock: true
      }
    });

    for (const product of products) {
      // Find all stock records for this product
      const stockRecords = product.stock;
      if (stockRecords.length <= 1) continue;

      // Group by warehouse
      const byWarehouse = {};
      for (const record of stockRecords) {
        if (!byWarehouse[record.warehouseId]) {
          byWarehouse[record.warehouseId] = [];
        }
        byWarehouse[record.warehouseId].push(record);
      }

      for (const warehouseId of Object.keys(byWarehouse)) {
        const records = byWarehouse[warehouseId];
        if (records.length <= 1) continue;

        // See if there is a null location record and a non-null location record
        const nullLocationRecord = records.find(r => r.locationId === null);
        const nonNullLocationRecords = records.filter(r => r.locationId !== null);

        if (nullLocationRecord && nonNullLocationRecords.length > 0) {
          // Merge null location into the first non-null location
          const targetRecord = nonNullLocationRecords[0];

          console.log(`Merging stock for product ${product.name} in warehouse ${warehouseId} from null location to location ${targetRecord.locationId}`);

          // Add quantities to target record
          await prisma.stock.update({
            where: { id: targetRecord.id },
            data: {
              quantity: { increment: nullLocationRecord.quantity },
              reservedQty: { increment: nullLocationRecord.reservedQty },
              damagedQty: { increment: nullLocationRecord.damagedQty },
              incomingQty: { increment: nullLocationRecord.incomingQty }
            }
          });

          // Delete the null location record
          await prisma.stock.delete({
            where: { id: nullLocationRecord.id }
          });

          // Also update StockMovements
          await prisma.stockMovement.updateMany({
            where: {
              productId: product.id,
              warehouseId: warehouseId,
              locationId: null
            },
            data: {
              locationId: targetRecord.locationId
            }
          });

          // Update StockAdjustments
          await prisma.stockAdjustment.updateMany({
             where: {
                warehouseId: warehouseId,
                locationId: null
             },
             data: {
                locationId: targetRecord.locationId
             }
          });
        }
      }
    }
    console.log("Merge complete");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

mergeStock();
