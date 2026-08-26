const prisma = require('./src/config/prisma');

async function main() {
    console.log("Dropping schema...");
    await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
