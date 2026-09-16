const prisma = require('./src/config/prisma');

async function main() {
  const taxFrameworks = await prisma.taxFramework.findMany({
    include: {
      taxTypes: {
        include: {
          rates: true
        }
      }
    }
  });
  
  const countries = await prisma.country.findMany();
  
  const countryMap = {};
  countries.forEach(c => countryMap[c.id] = c);

  for (const tf of taxFrameworks) {
    const country = countryMap[tf.countryId];
    console.log(`Framework: ${tf.name}, Country: ${country ? country.name : 'Unknown'} (${country ? country.code : '?'})`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
