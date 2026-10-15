const prisma = require('../src/config/prisma');

async function inspectPaymentAllocations() {
  const ids = [
    '685b7dc4-cf58-4c54-ad55-4b5512dafa21',
    '0f68f599-5e1f-4c98-8452-f72ef5a80bde',
    '1a1d5582-5761-430c-a614-542ab7b81cec',
    '66070230-11aa-4eb2-b02b-c90001098c23',
    'aff67fdc-48bc-485f-b8d1-a9c14cc4df68',
    '8702c234-88eb-4aef-bf75-79beead189df',
    '13b19b83-ef13-4183-8262-7f86cb090077',
    'f07802f5-0c12-4779-ba91-516ba17b096d',
    '9ad79927-786c-4e79-aae4-011cf776e08e',
    'a82903a9-3e48-4bbc-bdde-0e27ddbff045',
    'ebf6d389-9f3a-4d39-b879-6622938c48f7'
  ];
  const payments = await prisma.payment.findMany({
    where: { id: { in: ids } },
    include: {
      business: { select: { id: true, name: true, currency: true } },
      invoice: { select: { id: true, invoiceNumber: true, currency: true, exchangeRate: true } },
      bill: { select: { id: true, billNumber: true, currency: true, exchangeRate: true } },
      paymentAllocations: {
        include: {
          invoice: { select: { id: true, invoiceNumber: true, currency: true, exchangeRate: true, businessId: true } }
        }
      }
    }
  });

  const tableData = payments.map(p => {
    const alloc = p.paymentAllocations[0];
    const linkedInvoice = p.invoice || alloc?.invoice;
    const linkedBill = p.bill;
    const docCurrency = linkedInvoice?.currency || linkedBill?.currency || null;
    const docRate = linkedInvoice?.exchangeRate || linkedBill?.exchangeRate || 1;
    const shouldCurrency = docCurrency || p.business?.currency || 'INR';

    return {
      paymentId: p.id,
      paymentNumber: p.paymentNumber,
      amount: p.amount,
      businessId: p.business?.id || 'UNKNOWN',
      businessName: p.business?.name || 'UNKNOWN',
      businessCurrency: p.business?.currency || 'INR',
      storedCurrency: p.currency,
      storedRate: p.exchangeRate,
      storedBaseAmount: p.baseCurrencyAmount,
      linkedDoc: linkedInvoice ? `Invoice ${linkedInvoice.invoiceNumber}` : (linkedBill ? `Bill ${linkedBill.billNumber}` : 'Unlinked Advance'),
      linkedDocCurrency: docCurrency || 'None',
      shouldHaveCurrency: shouldCurrency,
      shouldHaveRate: docRate
    };
  });

  console.log(JSON.stringify(tableData, null, 2));
}

inspectPaymentAllocations().catch(console.error).finally(() => prisma.$disconnect());
