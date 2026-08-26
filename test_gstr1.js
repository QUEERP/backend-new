const prisma = require('./src/config/prisma');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
const invoiceService = require('./src/services/sales/invoice.service.js');

async function main() {
    // 1. Find a business in India
    const business = await prisma.business.findFirst({
        where: {
            taxFramework: { name: "India GST" }
        }
    });

    if (!business) {
        console.log("No India GST business found.");
        process.exit(0);
    }

    console.log(`Using Business: ${business.id}`);

    const customer = await prisma.customer.findFirst({ where: { businessId: business.id }});
    if (!customer) {
        console.log("No customer found.");
        process.exit(0);
    }

    // 2. Create an invoice to trigger TaxTransaction generation
    try {
        const inv = await invoiceService.createInvoice({
            businessId: business.id,
            customerId: customer.id,
            invoiceNumber: `GSTR1-TEST-${Date.now()}`,
            invoiceDate: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            currency: 'USD',
            exchangeRate: 83.5,
            items: [
                {
                    description: "Software Services",
                    quantity: 1,
                    unitPrice: 100, // 100 USD -> 8350 INR base
                    taxRateId: (await prisma.taxRate.findFirst({ where: { taxType: { taxFramework: { name: "India GST" } }, name: { contains: "IGST" } } })).id
                }
            ],
            notes: "Test invoice for GSTR-1"
        });
        console.log("Created invoice:", inv.id);
    } catch (e) {
        console.error("Failed to create invoice:", e);
    }

    // 3. Call the generator
    try {
        const data = await statutoryRegistry.generateReport("India GST", "GSTR1", business.id, {});
        console.log("--- GSTR1 REPORT DATA ---");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }

    process.exit(0);
}

main();
