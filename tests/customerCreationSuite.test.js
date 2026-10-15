const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = require('../src/config/prisma');
const businessMiddleware = require('../src/middlewares/business.middleware');
const customerController = require('../src/controllers/customerController');
const { decryptAccountNumber } = require('../src/utils/bankValidation');

const BUSINESS_ID = 'dc70ca38-b141-477d-a379-f02649117a78';

async function runCustomerCreationSuite() {
  console.log('======================================================================');
  console.log('            CUSTOMER CREATION & x-business-id TEST SUITE              ');
  console.log('======================================================================\n');

  // Test 1: Verify business.middleware rejects requests without x-business-id
  console.log('--- TEST 1: Business middleware rejection when businessId is absent ---');
  let rejectedStatus = null;
  let rejectedBody = null;
  const mockReqNoBiz = {
    user: { userId: 'subscription-admin', role: 'SUPER_ADMIN' },
    headers: {},
    query: {},
    body: {},
  };
  const mockResNoBiz = {
    status: (s) => {
      rejectedStatus = s;
      return {
        json: (b) => {
          rejectedBody = b;
        }
      };
    }
  };

  await businessMiddleware(mockReqNoBiz, mockResNoBiz, () => {});
  assert.strictEqual(rejectedStatus, 400, 'Expected 400 when businessId is missing');
  assert.strictEqual(rejectedBody.message, 'x-business-id header required');
  console.log('✔ Correctly returned 400 "x-business-id header required" when header is missing');

  // Test 2: Verify business.middleware accepts x-business-id header
  console.log('\n--- TEST 2: Business middleware accepts x-business-id header ---');
  let nextCalled = false;
  const mockReqWithHeader = {
    user: { userId: 'subscription-admin', role: 'SUPER_ADMIN' },
    headers: { 'x-business-id': BUSINESS_ID },
    query: {},
    body: {},
  };
  const mockResSuccess = {
    status: (s) => ({ json: (b) => {} })
  };

  await businessMiddleware(mockReqWithHeader, mockResSuccess, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true, 'Expected next() to be called with valid header');
  assert.ok(mockReqWithHeader.business, 'Expected req.business to be attached');
  assert.strictEqual(mockReqWithHeader.business.id, BUSINESS_ID);
  console.log(`✔ Passed business.middleware with x-business-id header: attached business "${mockReqWithHeader.business.name}"`);

  // Test 3: Verify business.middleware accepts fallback from body or query
  console.log('\n--- TEST 3: Business middleware fallback to body/query ---');
  let nextCalledBody = false;
  const mockReqBody = {
    user: { userId: 'subscription-admin', role: 'SUPER_ADMIN' },
    headers: {},
    query: {},
    body: { businessId: BUSINESS_ID },
  };
  await businessMiddleware(mockReqBody, mockResSuccess, () => {
    nextCalledBody = true;
  });
  assert.strictEqual(nextCalledBody, true, 'Expected next() to be called with body.businessId fallback');
  console.log('✔ Passed business.middleware with body.businessId fallback');

  // Test 4: Create customer with Australian bank account (as in screenshot)
  console.log('\n--- TEST 4: Create Australia Customer with BSB & Account Number ---');
  const testCompanyName = `Sydney Trading Pty Ltd AutoTest ${Date.now()}`;
  let customerCreatedStatus = null;
  let customerCreatedData = null;

  const mockCreateCustomerReq = {
    user: { userId: 'subscription-admin', role: 'SUPER_ADMIN' },
    business: mockReqWithHeader.business,
    membership: mockReqWithHeader.membership,
    headers: { 'x-business-id': BUSINESS_ID },
    body: {
      company: testCompanyName,
      country: 'AUSTRALIA',
      region: 'AUSTRALIA',
      currency: 'AUD',
      phone: '+61 400123456',
      website: 'https://sydneytrading.com.au',
      address: '100 George St',
      city: 'Sydney',
      state: 'NSW',
      zipCode: '2000',
      bankAccounts: [
        {
          accountHolderName: 'Sydney Trading Pty Ltd',
          bankName: 'Commonwealth Bank of Australia',
          accountNumber: '12345678',
          bsb: '062-000',
          country: 'AUSTRALIA',
          currency: 'AUD',
          isPrimary: true
        }
      ]
    }
  };

  const mockCreateCustomerRes = {
    status: (s) => {
      customerCreatedStatus = s;
      return {
        json: (d) => {
          customerCreatedData = d;
        }
      };
    }
  };

  await customerController.createCustomer(mockCreateCustomerReq, mockCreateCustomerRes);

  assert.strictEqual(customerCreatedStatus, 201, `Customer creation failed: ${JSON.stringify(customerCreatedData)}`);
  assert.ok(customerCreatedData.customer, 'Customer object should be returned');
  assert.strictEqual(customerCreatedData.customer.country, 'AUSTRALIA');
  assert.strictEqual(customerCreatedData.customer.currency, 'AUD');
  console.log(`✔ Created customer "${customerCreatedData.customer.company}" with ID: ${customerCreatedData.customer.id}`);

  // Test 5: Verify saved bank account details in database (encrypted & masked)
  console.log('\n--- TEST 5: Verify Australian Bank Account Encryption & Masking ---');
  const savedAccount = await prisma.customerBankAccount.findFirst({
    where: {
      customerId: customerCreatedData.customer.id,
      businessId: BUSINESS_ID
    }
  });

  assert.ok(savedAccount, 'Bank account should exist in database');
  assert.strictEqual(savedAccount.bankName, 'Commonwealth Bank of Australia');
  assert.strictEqual(savedAccount.bsb, '062000'); // Stripped non-digits
  assert.strictEqual(savedAccount.accountNumberMasked, '••••••••5678');
  assert.ok(savedAccount.accountNumberEncrypted, 'Account number must be encrypted');
  assert.notStrictEqual(savedAccount.accountNumberEncrypted, '12345678', 'Raw account number must NOT be in plaintext');

  const decrypted = decryptAccountNumber(savedAccount.accountNumberEncrypted);
  assert.strictEqual(decrypted, '12345678', 'Decrypted account number must match original');
  console.log(`✔ Australian Bank Account verified in DB:`);
  console.log(`  - BSB: ${savedAccount.bsb}`);
  console.log(`  - Masked: ${savedAccount.accountNumberMasked}`);
  console.log(`  - Encrypted: ${savedAccount.accountNumberEncrypted.substring(0, 32)}...`);
  console.log(`  - Decrypted test: ${decrypted}`);

  // Cleanup test customer & bank account non-destructively
  await prisma.customerBankAccount.deleteMany({
    where: { customerId: customerCreatedData.customer.id }
  });
  await prisma.customer.delete({
    where: { id: customerCreatedData.customer.id }
  });
  console.log('✔ Cleaned up test customer & bank account successfully');

  console.log('\n======================================================================');
  console.log('           ALL 5 CUSTOMER SUITE TESTS PASSED SUCCESSFULLY!            ');
  console.log('======================================================================');
}

runCustomerCreationSuite()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
