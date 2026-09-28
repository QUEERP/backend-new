const fs = require('fs');

const routesPath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/routes/purchaseRoutes.js';
let routesStr = fs.readFileSync(routesPath, 'utf8');

if (!routesStr.includes('/orders/:id/receive-all')) {
  routesStr = routesStr.replace(
    'router.patch("/orders/:id/status"',
    'router.post("/orders/:id/receive-all", auth, business, checkPermission("purchase_order", "update"), poController.markReceived);\nrouter.patch("/orders/:id/status"'
  );
  fs.writeFileSync(routesPath, routesStr);
}

const p = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/PO.Controller.js';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('exports.markReceived')) {
  c += `
exports.markReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: true, vendor: true }
    });

    if (!po) return res.status(404).json({ success: false, message: "PO not found" });
    if (po.status === "Received") return res.status(400).json({ success: false, message: "Already received" });

    await prisma.$transaction(async (tx) => {
      // Update PO
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "Received" }
      });

      // Find warehouse (default to first available)
      let whId = po.warehouseId;
      if (!whId) {
        const wh = await tx.warehouse.findFirst({ where: { businessId } });
        whId = wh ? wh.id : null;
      }

      // Generate GRN Number
      const grnCount = await tx.goodsReceiveNote.count({ where: { businessId } });
      const grnNumber = \`GRN-\${(grnCount + 1).toString().padStart(3, "0")}\`;

      // Create GRN
      if (whId) {
        await tx.goodsReceiveNote.create({
          data: {
            businessId,
            grnNumber,
            purchaseOrderId: po.id,
            vendorId: po.vendorId,
            warehouseId: whId,
            status: "RECEIVED",
            items: {
              create: po.items.map(i => ({
                productId: i.productId,
                quantityOrdered: i.quantity,
                quantityReceived: i.quantity,
                quantityDamaged: 0,
                price: i.price || 0
              }))
            }
          }
        });
      }

      // Generate Bill Number
      const billCount = await tx.bill.count({ where: { businessId } });
      const billNumber = \`BILL-\${(billCount + 1).toString().padStart(3, "0")}\`;

      // Create Bill
      await tx.bill.create({
        data: {
          businessId,
          billNumber,
          vendorId: po.vendorId,
          purchaseOrderId: po.id,
          subtotal: po.subtotal,
          tax: po.tax || 0,
          discount: po.discount || 0,
          totalAmount: po.totalAmount,
          currency: po.currencyCode || 'AED',
          billDate: new Date(),
          dueDate: new Date(),
          items: {
            create: po.items.map(i => ({
              name: i.description || i.name || 'Item',
              quantity: i.quantity,
              price: i.price,
              total: i.total,
              productId: i.productId,
              warehouseId: i.warehouseId || whId
            }))
          }
        }
      });
      
      // We skip stock increase since PurchaseWorkflow.receiveGoods was used in new-grn-page for manual
      // Actually let's increase stock directly here just in case!
      const InventoryService = require('../services/inventoryService');
      if (whId) {
         for (const item of po.items) {
           if (item.itemType === 'GOODS' && item.productId) {
             await InventoryService.increaseStock({
               businessId,
               productId: item.productId,
               warehouseId: whId,
               quantity: item.quantity,
               type: "PURCHASE_IN",
               reference: {
                 purchaseOrderId: po.id,
                 referenceNo: grnNumber
               },
               performedBy: req.user ? (req.user.userId || req.user.id) : 'system',
               note: \`Auto-Received PO \${po.poNumber}\`,
               tx
             });
           }
         }
      }
    });

    res.json({ success: true, message: "Marked received and generated GRN & Bill." });
  } catch (error) {
    console.error("markReceived error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
`;
  fs.writeFileSync(p, c);
}
console.log('Backend markReceived endpoint added.');
