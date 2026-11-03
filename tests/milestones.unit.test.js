require('dotenv').config({ path: './backend/.env' });
const assert = require('assert');
const prisma = require('../src/config/prisma');
const controller = require('../src/controllers/projectOperationsController');

async function runMilestoneTests() {
  console.log('====================================================');
  console.log('       RUNNING MILESTONES UPGRADE TEST SUITE        ');
  console.log('====================================================\n');

  // Find existing project and its business
  let project = await prisma.project.findFirst({ include: { business: true } });
  let businessId;
  let projectId;

  if (project) {
    businessId = project.businessId;
    projectId = project.id;
  } else {
    let business = await prisma.business.findFirst();
    assert(business, 'A business must exist for testing');
    businessId = business.id;
    project = await prisma.project.create({
      data: {
        business: { connect: { id: businessId } },
        projectCode: 'PRJ-TEST-MS',
        projectName: 'Milestone Test Project',
        status: 'ACTIVE'
      }
    });
    projectId = project.id;
  }
  console.log(`Using project: ${project.projectName} (${projectId})`);

  // Test 1: getNextMilestoneCode
  console.log('\n--- Test 1: Next Milestone Code Generation ---');
  let mockRes1 = {
    json(data) {
      assert(data.success, 'Next code must succeed');
      assert(data.nextCode.startsWith('MIL-'), 'Next code must start with MIL-');
      console.log(`✅ PASS: Generated next code: ${data.nextCode}`);
    },
    status() { return this; }
  };
  await controller.getNextMilestoneCode({ business: { id: businessId } }, mockRes1);

  // Test 2: getMilestoneFormOptions
  console.log('\n--- Test 2: Form Options Fetching ---');
  let mockRes2 = {
    json(data) {
      assert(data.success, 'Form options must succeed');
      assert(data.options, 'Options must be returned');
      assert(Array.isArray(data.options.categories), 'Categories must be an array');
      assert(Array.isArray(data.options.types), 'Types must be an array');
      assert(typeof data.options.remainingPaymentWeight === 'number', 'Remaining weight must be a number');
      console.log(`✅ PASS: Categories: ${data.options.categories.length}, Types: ${data.options.types.length}, Remaining weight: ${data.options.remainingPaymentWeight}%`);
    },
    status() { return this; }
  };
  await controller.getMilestoneFormOptions({ business: { id: businessId }, query: { projectId } }, mockRes2);

  // Test 3: Date validation (dueDate < startDate)
  console.log('\n--- Test 3: Due date < start date validation ---');
  let mockRes3 = {
    status(code) {
      assert.strictEqual(code, 400, 'Should return 400 on invalid dates');
      return this;
    },
    json(data) {
      assert(!data.success, 'Should fail');
      assert(data.message.includes('Due date must be on or after start date'), 'Correct error message');
      console.log(`✅ PASS: Correctly blocked due date before start date: "${data.message}"`);
    }
  };
  await controller.createMilestone({
    business: { id: businessId },
    user: { id: 'test-user-id' || 'test-user' },
    params: {},
    body: {
      projectId,
      name: 'Invalid Date Milestone',
      startDate: '2026-12-01',
      dueDate: '2026-11-01'
    }
  }, mockRes3);

  // Clean up any previous test artifacts first
  await prisma.projectMilestone.deleteMany({
    where: { milestoneCode: { in: ['MIL-UT-01', 'MIL-UT-02', 'MIL-UT-03'] } }
  });

  // Test 4: Create Valid Milestones and Test DFS Cycle Detection
  console.log('\n--- Test 4: DFS Dependency Cycle Check ---');
  let m1, m2;
  // Create Milestone 1
  await new Promise(resolve => {
    controller.createMilestone({
      business: { id: businessId },
      user: { id: 'test-user-id' || 'test-user' },
      params: {},
      body: {
        projectId,
        name: 'Unit Test Milestone 1',
        milestoneCode: 'MIL-UT-01',
        dueDate: '2026-12-01'
      }
    }, {
      status() { return this; },
      json(d) { m1 = d.milestone; resolve(); }
    });
  });

  // Create Milestone 2 depending on Milestone 1
  await new Promise(resolve => {
    controller.createMilestone({
      business: { id: businessId },
      user: { id: 'test-user-id' || 'test-user' },
      params: {},
      body: {
        projectId,
        name: 'Unit Test Milestone 2',
        milestoneCode: 'MIL-UT-02',
        dueDate: '2026-12-10',
        dependencies: [{ predecessorId: m1.id }]
      }
    }, {
      status() { return this; },
      json(d) { m2 = d.milestone; resolve(); }
    });
  });

  // Now try to update Milestone 1 to depend on Milestone 2 (creates cycle: m1 -> m2 -> m1)
  let mockResCycle = {
    status(code) {
      assert.strictEqual(code, 400, 'Cycle should return 400');
      return this;
    },
    json(data) {
      assert(!data.success, 'Cycle should not be allowed');
      assert(data.message.includes('Cyclic dependency detected'), 'Message should indicate cyclic dependency');
      console.log(`✅ PASS: Detected cycle with message: "${data.message}"`);
    }
  };
  await controller.updateMilestone({
    business: { id: businessId },
    user: { id: 'test-user-id' || 'test-user' },
    params: { id: m1.id },
    body: {
      dependencies: [{ predecessorId: m2.id }]
    }
  }, mockResCycle);

  // Test 5: Billing Weight Cap (Total <= 100%)
  console.log('\n--- Test 5: Billing Weight Cap Validation ---');
  let mockResWeight = {
    status(code) {
      assert.strictEqual(code, 400, 'Excess weight should return 400');
      return this;
    },
    json(data) {
      assert(!data.success, 'Excess weight should fail');
      assert(data.message.includes('Payment weight exceeds remaining capacity') || data.message.includes('between 0 and 100%'), 'Should indicate weight capacity');
      console.log(`✅ PASS: Blocked excess payment weight: "${data.message}"`);
    }
  };
  await controller.createMilestone({
    business: { id: businessId },
    user: { id: 'test-user-id' || 'test-user' },
    params: {},
    body: {
      projectId,
      name: 'Excess Billing Milestone',
      dueDate: '2026-12-15',
      isBilling: true,
      weight: 150
    }
  }, mockResWeight);

  // Test 6: Progress Rollup from Checklist Items
  console.log('\n--- Test 6: Progress Rollup from Checklist Items ---');
  let m3;
  await new Promise(resolve => {
    controller.createMilestone({
      business: { id: businessId },
      user: { id: 'test-user-id' || 'test-user' },
      params: {},
      body: {
        projectId,
        name: 'Unit Test Milestone 3 Items',
        dueDate: '2026-12-20',
        items: [
          { kind: 'DELIVERABLE', title: 'Task item 1', isDone: false },
          { kind: 'ACCEPTANCE_CRITERIA', title: 'Sign-off 1', isDone: false }
        ]
      }
    }, {
      status() { return this; },
      json(d) { m3 = d.milestone; resolve(); }
    });
  });

  assert.strictEqual(m3.completion, 0, 'Initial completion should be 0');
  const firstItem = m3.items[0];

  // Toggle first item to done
  await new Promise(resolve => {
    controller.toggleMilestoneItem({
      business: { id: businessId },
      params: { id: m3.id, itemId: firstItem.id },
      body: { isDone: true }
    }, {
      status() { return this; },
      json(d) {
        assert.strictEqual(d.milestoneProgress, 50, '1 of 2 items done should give 50%');
        console.log(`✅ PASS: Checklist toggle updated progress to: ${d.milestoneProgress}%`);
        resolve();
      }
    });
  });

  // Clean up test milestones
  console.log('\n--- Cleaning up test records ---');
  await prisma.projectMilestone.deleteMany({
    where: { id: { in: [m1.id, m2.id, m3.id] } }
  });
  console.log('✅ PASS: Cleaned up test milestones.');

  console.log('\n====================================================');
  console.log('🎉 ALL MILESTONE UNIT TESTS PASSED SUCCESSFULLY!    ');
  console.log('====================================================\n');
}

runMilestoneTests().then(() => process.exit(0)).catch(err => {
  console.error('❌ Milestone Unit Test Failed:', err);
  process.exit(1);
});
