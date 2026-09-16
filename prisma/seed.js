const prisma = require('../src/config/prisma');

async function main() {
  // Cleared deleteMany logic

  // Create Owner User
  const ownerUser = await prisma.user.upsert({
    where: { email: 'admin@uat.example.com' },
    update: {},
    create: {
      name: 'UAT Admin',
      email: 'admin@uat.example.com',
      password: 'hashedpassword',
    }
  });

  // Create Currencies
  const cad = await prisma.currency.upsert({ where: { code: 'CAD' }, update: {}, create: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CAD' } });
  const aed = await prisma.currency.upsert({ where: { code: 'AED' }, update: {}, create: { code: 'AED', name: 'UAE Dirham', symbol: 'AED' } });

  // Canada Business
  const canadaBusiness = await prisma.business.create({
    data: {
      name: 'Canada UAT Business',
      country: 'CANADA',
      baseCurrencyId: cad.id,
      timeZone: 'America/Toronto',

      ownerId: ownerUser.id,
      taxRules: {
        create: [
          { name: 'GST 5%', rate: 5, type: 'STANDARD', isRecoverable: true, priority: 10, countryCode: 'CA', placeOfSupply: 'INTRASTATE' },
          { name: 'PST 7%', rate: 7, type: 'STANDARD', isRecoverable: false, priority: 10, countryCode: 'CA', placeOfSupply: 'INTRASTATE' },
          { name: 'Zero-Rated', rate: 0, type: 'ZERO_RATED', isRecoverable: true, priority: 20, countryCode: 'CA', placeOfSupply: 'EXPORT' }
        ]
      }
    }
  });

  // UAE Business
  const uaeBusiness = await prisma.business.create({
    data: {
      name: 'UAE UAT Business',
      country: 'UAE',
      baseCurrencyId: aed.id,
      timeZone: 'Asia/Dubai',

      ownerId: ownerUser.id,
      taxRules: {
        create: [
          { name: 'Domestic Standard 5%', rate: 5, type: 'STANDARD', isRecoverable: true, priority: 20, countryCode: 'AE', placeOfSupply: 'INTRASTATE', supplyCategory: 'GOODS' },
          { name: 'Export 0%', rate: 0, type: 'ZERO_RATED', isRecoverable: true, priority: 10, countryCode: 'AE', placeOfSupply: 'EXPORT', supplyCategory: 'GOODS' },
          { name: 'Domestic Services 5%', rate: 5, type: 'STANDARD', isRecoverable: true, priority: 20, countryCode: 'AE', placeOfSupply: 'INTRASTATE', supplyCategory: 'SERVICES' },
          { name: 'Reverse Charge 5%', rate: 5, type: 'REVERSE_CHARGE', isRecoverable: true, priority: 5, countryCode: 'AE', placeOfSupply: 'IMPORT', supplyCategory: 'SERVICES', counterpartyTaxRegistrationStatus: 'UNREGISTERED' }
        ]
      }
    }
  });

  console.log('Seeded Canada and UAE UAT Businesses successfully.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => { prisma.$disconnect(); });
