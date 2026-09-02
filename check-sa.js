const prisma = require('./src/config/prisma');

async function check() {
    const sa = await prisma.country.findFirst({ where: { code: 'SA' } });
    console.log('SA country:', JSON.stringify(sa));
    if (sa) {
        const fw = await prisma.taxFramework.findMany({ where: { countryId: sa.id } });
        console.log('SA frameworks:', JSON.stringify(fw, null, 2));
    }
    // Check if TaxFramework has countryId as unique
    try {
        const fwByCountryId = await prisma.taxFramework.findUnique({ where: { countryId: sa?.id ?? 'x' } });
        console.log('findUnique by countryId result:', fwByCountryId);
    } catch (e) {
        console.log('findUnique by countryId error:', e.message);
    }
    await prisma.$disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });
