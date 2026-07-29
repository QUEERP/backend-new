const prisma = require('./src/config/prisma');

async function test() {
  try {
    const businesses = await prisma.business.findMany({});
    console.log("Success:", businesses.map(b => b.country));
  } catch (e) {
    console.error("Error:", e);
  } finally {
    process.exit(0);
  }
}
test();
