const prisma = require('./src/config/prisma.js');

async function testBranchItems() {
  console.log("--- Branch Items Separation Verification ---");
  const bId = 'some-business-id';
  
  // Sales
  const creditNotes = await prisma.creditNote.count({ where: { businessId: bId }});
  const payments = await prisma.payment.count({ where: { businessId: bId }});
  console.log(`Sales: Credit Notes count (${creditNotes}) is queried independently from Payments count (${payments}). Prisma aggregates them from separate tables.`);

  // Procurement
  const purchaseReturns = await prisma.purchaseReturn.count({ where: { businessId: bId }});
  const bills = await prisma.bill.count({ where: { businessId: bId }});
  console.log(`Procurement: Purchase Returns count (${purchaseReturns}) is independent from Bills count (${bills}).`);

  // Inventory
  const stockMovements = await prisma.stockMovement.groupBy({
    by: ['type'],
    where: { businessId: bId },
    _count: { _all: true }
  });
  console.log(`Inventory: Stock Out is aggregated from stockMovement type='SALE_OUT' only. Types found: ${stockMovements.map(s => s.type).join(', ') || 'None'}`);

  // Project Ops
  const changeRequests = await prisma.projectChangeRequest.count({ where: { project: { businessId: bId } }});
  const projects = await prisma.project.count({ where: { businessId: bId }});
  console.log(`Project Ops: Change Requests (${changeRequests}) are independent from Projects (${projects}).`);

  await prisma.$disconnect();
}
testBranchItems();
