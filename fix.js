const prisma = require('./src/config/prisma');

async function main() {
  const deals = await prisma.deal.findMany({ include: { customer: true } });
  
  for (let d of deals) {
    console.log('Deal:', d.name, 'DealCurrency:', d.currency, 'Customer:', d.customer.company, 'CustomerCurrency:', d.customer.currency, 'CustomerLeadId:', d.customer.leadId);
    
    if (d.customer && d.customer.leadId) {
       const lead = await prisma.lead.findUnique({ where: { id: d.customer.leadId } });
       if (lead && lead.currency) {
          console.log('  -> Found Lead Currency:', lead.currency);
          await prisma.deal.update({ where: { id: d.id }, data: { currency: lead.currency } });
       }
    }
  }
}

main().catch(console.error);
