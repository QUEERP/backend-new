const prisma = require('./src/config/prisma');
async function main() {
  const c = await prisma.customer.findUnique({
    where: { id: '2cbac661-51c9-4d78-a809-ee81f6aa8da1' }
  });
  console.log(c);
}
main().catch(console.error).finally(() => process.exit(0));
