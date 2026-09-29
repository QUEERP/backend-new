const prisma = require("../config/prisma");
const PurchaseWorkflow = require("../services/purchaseWorkflow");

const VALID_STATUS = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIAL_RECEIVED", "FULLY_RECEIVED", "CANCELLED"];

//////////////////////////////////////////////////////
// GENERATE PO NUMBER
//////////////////////////////////////////////////////
const generatePONumber = async (businessId) => {
  const count = await prisma.purchaseOrder.count({ where: { businessId } });
  return `PO-${(count + 1).toString().padStart(3, "0")}`;
};

//////////////////////////////////////////////////////
// CREATE PURCHASE ORDER
//////////////////////////////////////////////////////
exports.createPurchaseOrder = async (req, res) => {
  try {
    const {
      vendorId,
      assignedToId,
      items,
      discount = 0,
      orderDate,
      expectedDeliveryDate,
      notes,
    } = req.body;

    if (!vendorId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "vendorId and items are required",
      });
    }

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, businessId: req.business.id },
    });

    if (!vendor) {
      return res.status(400).json({ success: false, message: "Vendor not found" });
    }

    let subtotal = 0;
    let totalTax = 0;

    const mappedItems = items.map(item => {
      const lineAmount = Number(item.quantity) * Number(item.price);
      const lineTax = (lineAmount * Number(item.taxPercent || 0)) / 100;
      subtotal += lineAmount;
      totalTax += lineTax;

      return {
        productId: item.productId,
        warehouseId: item.warehouseId,
        description: item.description || item.name,
        itemType: item.itemType || item.type || 'GOODS',
        hsnSacCode: item.hsnSacCode || item.hsn,
        quantity: Number(item.quantity),
        price: Number(item.price),
        
        total: lineAmount + lineTax
      };
    });

    const order = await prisma.purchaseOrder.create({
      data: {
        businessId: req.business.id,
        poNumber: await generatePONumber(req.business.id),
        vendorId,
        assignedToId,
        subtotal,
        tax: totalTax,
        discount,
        totalAmount: subtotal + totalTax - discount,
        orderDate: new Date(orderDate),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        notes,
        currencyCode: req.body.currencyCode || 'AED',
        currencySymbol: req.body.currencySymbol || 'AED',
        items: { create: mappedItems },
      },
      include: { vendor: true, items: true },
    });

    res.status(201).json({ success: true, order });

  } catch (error) {
    console.error("createPurchaseOrder error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// RECEIVE GOODS (GRN Flow)
//////////////////////////////////////////////////////
exports.receiveGoods = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, grnNumber, note } = req.body;

    const result = await PurchaseWorkflow.receiveGoods({
      businessId: req.business.id,
      purchaseOrderId: id,
      grnNumber: grnNumber || `GRN-${Date.now()}`,
      items,
      performedBy: req.user.userId,
      note
    });

    res.json(result);
  } catch (error) {
    console.error("receiveGoods error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// GET ALL PURCHASE ORDERS
//////////////////////////////////////////////////////
exports.getPurchaseOrders = async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        businessId: req.business.id,
      },
      include: {
        vendor: true,
        items: true,
        assignedTo: {
          include: { user: true }
        },
        warehouse: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      orders,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// GET SINGLE PURCHASE ORDER
//////////////////////////////////////////////////////
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.purchaseOrder.findFirst({
      where: {
        id,
        businessId: req.business.id,
      },
      include: {
        vendor: true,
        items: true,
        assignedTo: {
          include: { user: true }
        },
        warehouse: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    res.json({
      success: true,
      order,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// UPDATE PURCHASE ORDER
//////////////////////////////////////////////////////
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.status && !VALID_STATUS.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    if (req.body.orderDate) {
      req.body.orderDate = new Date(req.body.orderDate);
    }

    if (req.body.expectedDeliveryDate) {
      req.body.expectedDeliveryDate = new Date(req.body.expectedDeliveryDate);
    }

    const { items, ...updateData } = req.body;
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        vendor: true,
        items: true,
      },
    });

    res.json({
      success: true,
      order,
    });

  } catch (error) {
    console.error("updatePurchaseOrder error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// DELETE PURCHASE ORDER
//////////////////////////////////////////////////////
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.purchaseOrder.deleteMany({
      where: {
        id,
        businessId: req.business.id,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    res.json({
      success: true,
      message: "Purchase order deleted",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.markReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: true, vendor: true }
    });

    if (!po) return res.status(404).json({ success: false, message: "PO not found" });
    if (po.status === "FULLY_RECEIVED") return res.status(400).json({ success: false, message: "Already received" });

    await prisma.$transaction(async (tx) => {
      // Update PO
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "FULLY_RECEIVED" }
      });

      // Find warehouse (default to first available)
      let whId = po.warehouseId;
      if (!whId) {
        const wh = await tx.warehouse.findFirst({ where: { businessId } });
        whId = wh ? wh.id : null;
      }

      // Generate GRN Number
      const grnCount = await tx.goodsReceiveNote.count({ where: { businessId } });
      const grnNumber = `GRN-${(grnCount + 1).toString().padStart(3, "0")}`;

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
      const billNumber = `BILL-${(billCount + 1).toString().padStart(3, "0")}`;

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
               note: `Auto-Received PO ${po.poNumber}`,
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

