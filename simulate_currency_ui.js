const prisma = require('./src/config/prisma');
const reportController = require('./src/controllers/reportController');

async function test() {
    try {
        const owner = await prisma.user.findUnique({ where: { email: 'devpriya@gmail.com' } });
        if (!owner) throw new Error("Could not find devpriya@gmail.com");

        const biz = await prisma.business.findFirst({
            where: { name: 'Test India' }
        });
        if (!biz) throw new Error("Could not find Test India business");
        
        console.log(`Found Business: ${biz.name} (${biz.id})`);

        // Mock req/res for getCurrencyUsage
        const req = {
            business: { id: biz.id },
            query: {}
        };
        
        let usageData = null;
        let gainLossData = null;
        
        const makeRes = (cb) => ({
            json: (data) => { cb(data); return data; },
            status: () => makeRes(cb)
        });

        await reportController.getCurrencyUsage(req, makeRes(d => usageData = d));
        await reportController.getCurrencyGainLoss(req, makeRes(d => gainLossData = d));

        console.log("\n==============================================");
        console.log("       UI RENDER: CURRENCY REPORTS PAGE");
        console.log("==============================================\n");

        console.log("usageData =", JSON.stringify(usageData, null, 2));
        console.log("gainLossData =", JSON.stringify(gainLossData, null, 2));
        if (!usageData || !usageData.usage) {
            console.log("No usage data returned. Aborting.");
            return;
        }

        const gl = gainLossData.fxGainLoss || { realizedGain: 0, realizedLoss: 0, netGainLoss: 0 };
        console.log(`[BUSINESS-WIDE FX] Realized Gain: ${gl.realizedGain} | Realized Loss: ${gl.realizedLoss} | Net: ${gl.netGainLoss}\n`);

        for (const item of usageData.usage) {
            console.log(`[CARD] Currency: ${item.currency}`);
            console.log(`       All transactions reported in ${item.currency}\n`);
            
            console.log(`       | Total Sales        | Total Purchases   | Receivables       | Payables          |`);
            console.log(`       |--------------------|-------------------|-------------------|-------------------|`);
            console.log(`       | ${item.summary.sales.toString().padEnd(14)} Base| ` + 
                        `${item.summary.purchases.toString().padEnd(13)} Base| ` +
                        `${item.summary.receivables.toString().padEnd(13)} Base| ` +
                        `${item.summary.payables.toString().padEnd(13)} Base| `);
            console.log("\n-----------------------------------------------------------------------------------------");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}
test();
