const fs = require('fs');
const file = 'C:/Users/DELL/Downloads/new-queerp/backend/src/services/inventory/stockTransfer.service.js';
let content = fs.readFileSync(file, 'utf8');

const newFunc = `
const updateStockTransfer = async (businessId, userId, userEmail, transferId, data) => {
  return await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findFirst({
      where: { id: transferId, businessId },
      include: { items: true }
    });
    if (!transfer) throw new Error('Stock transfer not found');
    if (transfer.status !== 'PENDING') throw new Error('Only PENDING transfers can be edited.');
    
    // Delete old items
    await tx.stockTransferItem.deleteMany({
      where: { stockTransferId: transferId }
    });

    const updated = await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        fromWarehouseId: data.fromWarehouseId !== undefined ? data.fromWarehouseId : transfer.fromWarehouseId,
        fromLocationId: data.fromLocationId !== undefined ? (data.fromLocationId || null) : transfer.fromLocationId,
        toWarehouseId: data.toWarehouseId !== undefined ? data.toWarehouseId : transfer.toWarehouseId,
        toLocationId: data.toLocationId !== undefined ? (data.toLocationId || null) : transfer.toLocationId,
        transferDate: data.transferDate ? new Date(data.transferDate) : transfer.transferDate,
        notes: data.notes !== undefined ? data.notes : transfer.notes,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity),
            batchNumber: item.batchNumber || null,
            serialNumbers: item.serialNumbers || []
          }))
        }
      },
      include: {
        items: true,
        fromWarehouse: true,
        toWarehouse: true,
        fromLocation: true,
        toLocation: true
      }
    });

    await logAction(tx, {
      businessId,
      userId,
      userEmail,
      action: 'STOCK_TRANSFER_UPDATED',
      module: 'INVENTORY',
      entityType: 'StockTransfer',
      entityId: transfer.id,
      details: { transferNumber: transfer.transferNumber }
    });

    return updated;
  });
};
`;

content = content.replace('module.exports = {', newFunc + '\nmodule.exports = {\n  updateStockTransfer,');
fs.writeFileSync(file, content);
console.log('Modified stockTransfer.service.js');
