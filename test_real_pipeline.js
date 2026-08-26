const prisma = require('./src/config/prisma');
const { createInvoice } = require('./src/services/sales/invoice.service');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');

async function test() {
  try {
      const biz = await prisma.business.findFirst({ where: { taxFramework: { name: 'India GST' } } });
      if (!biz) throw new Error('No India GST business found');
      
      const cust = await prisma.customer.findFirst({ where: { businessId: biz.id, region: 'INDIA' } });
      if (!cust) throw new Error('No customer found');

      // create a tax rate just in case, but calculateTax will use whatever is configured. 
      // Actually, test-sales.js might have configured products. Let's just create an invoice.
      
      const invoiceData = {
          customerId: cust.id,
          invoiceNumber: 'GSTR1-REAL-' + Date.now(),
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          currency: 'INR',
          items: [
              {
                  description: 'Software Services',
                  quantity: 1,
                  rate: 1000,
                  taxPercent: 18 // this should trigger calculateTax
              }
          ]
      };

      const inv = await createInvoice(biz.id, 'admin', 'admin@example.com', invoiceData);
      console.log('Created real invoice:', inv.id);
      
      const data = await statutoryRegistry.generateReport('India GST', 'GSTR1', biz.id, {
          startDate: '2020-01-01',
          endDate: '2030-12-31'
      });
      console.log('\n--- GSTR1 REPORT DATA ---');
      console.log(JSON.stringify(data, null, 2));

      await prisma.invoice.delete({ where: { id: inv.id } });
  } catch (err) {
      console.error('Error:', err);
  } finally {
      await prisma.$disconnect();
  }
}
test();
