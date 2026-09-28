const fs = require('fs');

const p = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/BillController.js';
let c = fs.readFileSync(p, 'utf8');

// Replace createBill
const createRegex = /exports\.createBill = async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{[\s\S]*?\}\);\s*\n\s*\};\s*\n/m;
const newCreate = `exports.createBill = async (req, res) => {
  try {
    const {
      vendorId,
      purchaseOrderId,
      items = [],
      discount = 0,
      billDate,
      dueDate,
      notes,
    } = req.body;

    const taxValue = req.body.tax !== undefined ? Number(req.body.tax) : (req.body.taxAmount !== undefined ? Number(req.body.taxAmount) : 0);
    const currency = req.body.currency || 'AED';

    if (!billDate) {
      return res.status(400).json({ success: false, message: "billDate is required" });
    }

    if (!vendorId && !purchaseOrderId) {
      return res.status(400).json({ success: false, message: "Either vendorId or purchaseOrderId is required" });
    }

    let finalItems = items.map(i => ({
      name: i.name || i.description || 'Item',
      quantity: Number(i.quantity || 0),
      price: Number(i.price !== undefined ? i.price : (i.unitPrice || 0))
    }));
    let finalVendorId = vendorId;

    if (purchaseOrderId) {
      const po = await prisma.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, businessId: req.business.id },
        include: { items: true },
      });
      if (!po) return res.status(400).json({ success: false, message: "Purchase Order not found" });
      finalVendorId = po.vendorId;
      finalItems = po.items.map((i) => ({
        name: i.name || i.description || 'Item',
        quantity: i.quantity,
        price: i.price,
      }));
    }

    const vendor = await prisma.vendor.findFirst({
      where: { id: finalVendorId, businessId: req.business.id },
    });
    if (!vendor) return res.status(400).json({ success: false, message: "Vendor not found" });

    const subtotal = req.body.subtotal !== undefined ? Number(req.body.subtotal) : finalItems.reduce((sum, i) => sum + i.quantity * i.price, 0);
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount) : (subtotal + taxValue - discount);

    const bill = await prisma.bill.create({
      data: {
        businessId: req.business.id,
        billNumber: await generateBillNumber(req.business.id),
        vendorId: finalVendorId,
        purchaseOrderId,
        subtotal,
        tax: taxValue,
        discount,
        totalAmount,
        currency,
        billDate: new Date(billDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        items: {
          create: finalItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            total: i.quantity * i.price,
          })),
        },
      },
      include: { vendor: true, items: true, purchaseOrder: true },
    });

    res.status(201).json({ success: true, bill });
  } catch (error) {
    console.error("createBill error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
`;

c = c.replace(createRegex, newCreate);

const updateRegex = /exports\.updateBill = async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{[\s\S]*?\}\);\s*\n\s*\};\s*\n/m;
const newUpdate = `exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      items = [],
      discount = 0,
      billDate,
      dueDate,
      notes,
    } = req.body;
    
    const taxValue = req.body.tax !== undefined ? Number(req.body.tax) : (req.body.taxAmount !== undefined ? Number(req.body.taxAmount) : 0);
    const currency = req.body.currency || 'AED';

    const bill = await prisma.bill.findFirst({
      where: { id, businessId: req.business.id },
    });

    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });

    const finalItems = items.map(i => ({
      name: i.name || i.description || 'Item',
      quantity: Number(i.quantity || 0),
      price: Number(i.price !== undefined ? i.price : (i.unitPrice || 0))
    }));

    const subtotal = req.body.subtotal !== undefined ? Number(req.body.subtotal) : finalItems.reduce((sum, i) => sum + i.quantity * i.price, 0);
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount) : (subtotal + taxValue - discount);

    await prisma.billItem.deleteMany({ where: { billId: id } });

    const updated = await prisma.bill.update({
      where: { id },
      data: {
        subtotal,
        tax: taxValue,
        discount,
        totalAmount,
        currency,
        billDate: billDate ? new Date(billDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        items: {
          create: finalItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            total: i.quantity * i.price,
          })),
        },
      },
      include: { vendor: true, items: true },
    });

    res.json({ success: true, bill: updated });
  } catch (error) {
    console.error("updateBill error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
`;

c = c.replace(updateRegex, newUpdate);

fs.writeFileSync(p, c);
console.log('Fixed BillController.js');
