const fs = require('fs');
const p = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/BillController.js';
let c = fs.readFileSync(p, 'utf8');
const replacement = `exports.getBills = async (req, res) => {
  try {
    const bills = await prisma.bill.findMany({
      where: { businessId: req.business.id },
      include: { vendor: true, items: true, purchaseOrder: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBillById`;
c = c.replace('exports.getBillById', replacement);
fs.writeFileSync(p, c);
console.log('Restored getBills');
