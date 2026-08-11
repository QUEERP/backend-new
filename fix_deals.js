const prisma = require('./src/config/prisma');

async function main() {
  const logs = await prisma.leadConversionLog.findMany({
    include: { lead: true }
  });
  
  for (const log of logs) {
    if (log.dealId && log.lead && log.lead.currency) {
      console.log(`Log ${log.id}: Deal ${log.dealId} -> Currency ${log.lead.currency}`);
      await prisma.deal.update({
        where: { id: log.dealId },
        data: { currency: log.lead.currency }
      });
      console.log('Successfully updated deal to', log.lead.currency);
    }
  }
}

main().catch(console.error);
