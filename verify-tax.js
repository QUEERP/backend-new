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
    
    console.log(`Found Business: ${biz.name} (${biz.id})`);
    
    const req = {
        business: { id: biz.id },
        query: {}
    };
    
    const res = {
        json: (data) => {
            console.log(JSON.stringify(data, null, 2));
            return data;
        },
        status: function(code) {
            console.log(`Status: ${code}`);
            return this;
        }
    };
    
    await reportController.getTaxSummary(req, res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
