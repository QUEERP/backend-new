const prisma = require('./src/config/prisma');

async function test() {
  try {
    const businessId = "e24ee048-2039-4c2e-a1c9-24bf7b2f943e"; // From the URL in the screenshot

    const invoiceAgg = await prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId, isDeleted: false, status: { not: "CANCELLED" } }
    });
    console.log("Invoice Agg:", invoiceAgg);

    const expenseAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId }
    });
    console.log("Expense Agg:", expenseAgg);

    const paymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { businessId }
    });
    console.log("Payment Agg:", paymentAgg);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
