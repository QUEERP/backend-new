const prisma = require('./src/config/prisma');
const reportController = require('./src/controllers/reportController');

async function main() {
    const biz = await prisma.business.findFirst({ 
        where: { name: 'Test India' },
        orderBy: { createdAt: 'desc' }
    });
    
    if (!biz) {
        console.error("Test India business not found");
        process.exit(1);
    }
    
    const req = {
        business: { id: biz.id },
        query: {}
    };
    
    const res = {
        json: (data) => console.log(JSON.stringify(data, null, 2)),
        status: () => res
    };
    
    console.log('\n--- Usage Report ---');
    await reportController.getCurrencyUsage(req, res);
    
    console.log('\n--- Gain/Loss Report ---');
    await reportController.getCurrencyGainLoss(req, res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
