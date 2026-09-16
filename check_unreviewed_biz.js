const prisma = require('./src/config/prisma');

const UNREVIEWED_COUNTRIES = ['CN', 'MY', 'PL', 'SE', 'NO', 'BE', 'AT', 'TH', 'VN', 'PH', 'TW', 'OM', 'BH', 'IE', 'ID'];

async function checkBusinesses() {
  const businesses = await prisma.business.findMany({
    where: {
      countryCode: {
        in: UNREVIEWED_COUNTRIES
      },
      NOT: {
        name: {
          startsWith: 'Test '
        }
      }
    }
  });
  console.log("Real businesses using unreviewed countries:");
  console.log(businesses);
}

checkBusinesses()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
