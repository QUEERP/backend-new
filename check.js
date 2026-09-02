const prisma = require('./src/config/prisma');
async function run() {
    for (const code of ['JP', 'ZA']) {
        const c = await prisma.country.findFirst({ where: { code }});
        if(c) {
            const fws = await prisma.taxFramework.findMany({ where: { countryId: c.id }});
            for (const fw of fws) {
                console.log(`Deleting ${fw.name}...`);
                await prisma.taxRule.deleteMany({ where: { business: { taxFrameworkId: fw.id } } });
                await prisma.taxRate.deleteMany({ where: { taxType: { taxFrameworkId: fw.id } } });
                await prisma.taxType.deleteMany({ where: { taxFrameworkId: fw.id } });
                await prisma.taxFramework.delete({ where: { id: fw.id } });
            }
        }
    }
    await prisma.$disconnect();
}
run();
