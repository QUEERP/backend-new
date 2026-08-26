const fs = require('fs');
const prisma = require('./src/config/prisma');

async function main() {
    console.log("Reading schema.sql...");
    const sql = fs.readFileSync('schema.sql', 'utf8');
    
    // We might have to split by statement or Prisma executeRaw might execute all at once.
    // executeRawUnsafe supports multiple statements separated by semi-colon.
    console.log("Executing schema.sql...");
    await prisma.$executeRawUnsafe(sql);
    console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
