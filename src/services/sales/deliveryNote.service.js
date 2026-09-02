const prisma = require('../../config/prisma');

class DeliveryNoteService {
  async createDeliveryNote(businessId, data) {
    return await prisma.$transaction(async (tx) => {
      // 1. Create Delivery Note
      const deliveryNote = await tx.deliveryNote.create({
        data: {
          businessId,
          customerId: data.customerId,
          salesOrderId: data.salesOrderId,
          deliveryNumber: data.deliveryNumber,
          status: 'DISPATCHED',
          date: data.date || new Date(),
          taxPointTrigger: data.taxPointTrigger || 'INVOICE', // INVOICE or DELIVERY
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: item.quantity,
              unit: item.unit
            }))
          }
        },
        include: { items: true }
      });

      // 2. Inventory deductions
      // Typically we'd call an InventoryService here to reduce stock levels.
      // e.g. InventoryService.recordMovement('RETURN_OUT', ...)

      // 3. Tax Point Trigger Handling
      if (deliveryNote.taxPointTrigger === 'DELIVERY') {
        // If the jurisdiction requires tax recognition upon dispatch rather than invoice,
        // we would call TaxEngine and TransactionHelper here.
        // Currently implemented as informational only.
        console.warn('Delivery-based tax point trigger recognized but tax ledger posting is currently deferred to the formal Invoice.');
      }

      return deliveryNote;
    });
  }
}

module.exports = new DeliveryNoteService();
