require('dotenv').config();
const prisma = require('./src/config/prisma');
const TransactionHelper = require('./src/services/TransactionHelper');
const DebitNoteService = require('./src/services/purchase/debitNote.service');

async function testDebitNote() {
  try {
    const devPriya = await prisma.taxTransaction.findUnique({
      where: { id: '6525449f-31fc-4457-bf14-c03e69447278' }
    });

    console.log("Simulating Bill and Debit Note...");
    
    await prisma.$transaction(async (tx) => {
      // 1. Setup minimal dummy Bill with a manual override
      const bill = await tx.bill.create({
          data: {
              businessId: devPriya.businessId,
              vendorId: 'some-dummy-vendor-id',
              billNumber: 'BILL-TEST-001',
              subtotal: 100,
              tax: 5,
              totalAmount: 105,
              status: 'UNPAID',
              currency: 'AED',
              transactionCurrencyId: null,
              baseCurrencyId: null,
              exchangeRate: 1,
              statutoryExchangeRate: 1,
              billDate: new Date()
          }
      });
      
      const txns = await TransactionHelper.processTransactionFinancials({
          businessId: devPriya.businessId,
          transactionDate: new Date(),
          currencyCode: 'AED',
          items: [{
              productId: 'prod-dummy',
              quantity: 1,
              price: 100,
              isManualOverride: true,
              manualOverrideRate: 5,
              overrideTaxTypeId: 'dummy-tax-type-id', // The one we created
              manualOverrideReason: 'Testing override'
          }],
          vendorId: 'some-dummy-vendor-id',
          transactionType: 'PURCHASE',
          txClient: tx,
          userId: 'test-user'
      });
      
      await TransactionHelper.saveTaxLedger(tx, devPriya.businessId, 'BILL', bill.id, txns.taxTransactions);
      
      // 2. Test DebitNote pulling from that Bill
      const data = {
          billId: bill.id,
          vendorId: bill.vendorId,
          debitNumber: "DN-TEST-001",
          date: new Date(),
          currency: bill.currency,
          items: [{
              productId: 'prod-dummy',
              quantity: 1,
              rate: 100
          }]
      };

      const debitNote = await DebitNoteService.createDebitNote(devPriya.businessId, data, "test-user");
      
      const debitNoteTxns = await tx.taxTransaction.findMany({
          where: { transactionId: debitNote.id, transactionType: 'DEBIT_NOTE' }
      });

      console.log("Debit Note Tax Transactions:", JSON.stringify(debitNoteTxns, null, 2));
      
      // Rollback the transaction to keep DB clean
      throw new Error("ROLLBACK_FOR_TEST");
    });

  } catch (e) {
    if (e.message !== "ROLLBACK_FOR_TEST") {
       console.error("Error testing:", e);
    } else {
       console.log("Test completed successfully, rolled back dummy data.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDebitNote();
