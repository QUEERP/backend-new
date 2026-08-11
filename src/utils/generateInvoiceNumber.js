const prisma = require("../config/prisma");

module.exports = async (businessId, tx = prisma) => {
  let nextNum = 1;
  
  // Find the most recently created invoice for this business
  const lastInvoice = await tx.invoice.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true }
  });
  
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split("-");
    const numStr = parts[parts.length - 1];
    nextNum = isNaN(parseInt(numStr, 10)) ? 1 : parseInt(numStr, 10) + 1;
  }

  let invoiceNumber = "";
  let isUnique = false;

  // Ensure the generated number is unique within this business
  while (!isUnique) {
    invoiceNumber = `INV-${String(nextNum).padStart(3, "0")}`;
    const existing = await tx.invoice.findFirst({
      where: { invoiceNumber, businessId }
    });
    
    if (!existing) {
      isUnique = true;
    } else {
      nextNum++;
    }
  }

  return invoiceNumber;
};