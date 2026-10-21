const prisma = require('../src/config/prisma');

const STANDARD_CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', decimals: 2 },
  { code: 'QAR', name: 'Qatari Rial', symbol: 'QR', decimals: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', decimals: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', decimals: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'RO', decimals: 3 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 2 }
];

async function seedCurrencies() {
  console.log('--- Seeding Standard System Currencies ---');
  let count = 0;
  for (const c of STANDARD_CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        symbol: c.symbol,
        decimals: c.decimals,
        decimalPrecision: c.decimals
      },
      create: {
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        decimals: c.decimals,
        decimalPrecision: c.decimals
      }
    });
    count++;
  }
  console.log(`Successfully ensured ${count} currencies in system currency master.`);
}

if (require.main === module) {
  seedCurrencies()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed currencies:', err);
      process.exit(1);
    });
}

module.exports = { seedCurrencies, STANDARD_CURRENCIES };
