const prisma = require('./src/config/prisma');
const InventoryService = require('./src/services/inventoryService');
const StockService = require('./src/services/inventory/stock.service');
const StockTransferService = require('./src/services/inventory/stockTransfer.service');
const StockAdjustmentService = require('./src/services/inventory/stockAdjustment.service');

async function testRegression() {
  console.log("Starting Regression Test for Non-Trading Business...");
  
  // 0. Create a dummy user
  const user = await prisma.user.create({
    data: {
      email: `user-${Date.now()}@test.com`,
      name: 'Test User',
      password: 'password123',
    }
  });

  // 1. Create a dummy non-trading business
  const business = await prisma.business.create({
    data: {
      name: 'Test Service Business',
      businessType: 'service', // explicitly non-trading
      ownerId: user.id
    }
  });
  console.log("Created business:", business.id);

  // 2. Create a warehouse for this business
  const warehouse = await prisma.warehouse.create({
    data: {
      businessId: business.id,
      name: 'Test Warehouse',
      city: 'Test City',
      country: 'Test Country'
    }
  });
  console.log("Created warehouse:", warehouse.id);

  // 3. Create a product for this business
  const product = await prisma.product.create({
    data: {
      businessId: business.id,
      name: 'Test Product',
      sku: `SKU-${Date.now()}`,
      price: 100,
      costPrice: 50,
      type: 'GOODS'
    }
  });
  console.log("Created product:", product.id);

  // 4. Increase stock for non-trading business (should have locationId = null)
  await InventoryService.increaseStock({
    businessId: business.id,
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 50,
    type: 'OPENING_STOCK',
    performedBy: 'TestUser'
  });
  console.log("Increased stock by 50");

  // 5. Verify the created stock
  const stock = await prisma.stock.findFirst({
    where: {
      productId: product.id,
      warehouseId: warehouse.id
    }
  });
  console.log("Verified Stock Record:");
  console.log(" - Quantity:", stock.quantity);
  console.log(" - locationId:", stock.locationId);

  // 6. Increase stock again to test the explicit findFirst logic (should update existing row)
  await InventoryService.increaseStock({
    businessId: business.id,
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 25,
    type: 'OPENING_STOCK',
    performedBy: 'TestUser'
  });
  console.log("Increased stock by another 25");

  // 7. Verify stock updated correctly (quantity should be 75, locationId still null)
  const allStocks = await prisma.stock.findMany({
    where: {
      productId: product.id,
      warehouseId: warehouse.id
    }
  });
  console.log("Total Stock Rows Found (should be 1):", allStocks.length);
  if (allStocks.length > 0) {
    console.log(" - Final Quantity:", allStocks[0].quantity);
    console.log(" - Final locationId:", allStocks[0].locationId);
  }

  // --- NEW REGRESSION CHECKS ---

  // Check 1: Query stock levels and confirm `location` is ABSENT (not just null).
  const stockLevels = await StockService.getStockLevels(business.id, { productId: product.id });
  const stockRecord = stockLevels[0];
  console.log("Check 1: Stock Query");
  if ('location' in stockRecord) {
    console.error(" - FAILED: 'location' field is present in the response.");
  } else {
    console.log(" - PASSED: 'location' field is entirely absent from the response.");
  }

  // Check 2: Stock Transfer
  console.log("\nCheck 2: Stock Transfer");
  const warehouse2 = await prisma.warehouse.create({
    data: { businessId: business.id, name: 'Test Warehouse 2', city: 'City2', country: 'Country2' }
  });
  console.log(" - Created second warehouse:", warehouse2.id);

  const transferData = {
    transferDate: new Date(),
    fromWarehouseId: warehouse.id,
    toWarehouseId: warehouse2.id,
    items: [
      { productId: product.id, quantity: 10 }
    ],
    notes: 'Test Transfer'
  };

  const transferResult = await StockTransferService.createStockTransfer(business.id, user.id, user.email, transferData);
  const dbTransfer = await prisma.stockTransfer.findUnique({ where: { id: transferResult.id } });
  
  if (dbTransfer.fromLocationId === null && dbTransfer.toLocationId === null) {
    console.log(" - PASSED: Transfer succeeded and fromLocationId/toLocationId are perfectly null in DB.");
  } else {
    console.error(" - FAILED: Transfer locations are not null in DB.");
  }

  // Check 3: Stock Adjustment
  console.log("\nCheck 3: Stock Adjustment");
  const adjustmentData = {
    adjustmentDate: new Date(),
    warehouseId: warehouse.id,
    reason: 'DAMAGE',
    notes: 'Test Adjustment',
    items: [
      { productId: product.id, quantity: 2, type: 'SUBTRACT' }
    ]
  };

  const adjustmentResult = await StockAdjustmentService.createStockAdjustment(business.id, user.id, user.email, adjustmentData);
  const dbAdjustment = await prisma.stockAdjustment.findUnique({ where: { id: adjustmentResult.id } });

  if (dbAdjustment.locationId === null) {
    console.log(" - PASSED: Adjustment succeeded and locationId is null in DB.");
  } else {
    console.error(" - FAILED: Adjustment location is not null in DB.");
  }

  // Cleanup
  await prisma.stockMovement.deleteMany({ where: { businessId: business.id } });
  await prisma.stockTransferItem.deleteMany({ where: { stockTransfer: { businessId: business.id } } });
  await prisma.stockTransfer.deleteMany({ where: { businessId: business.id } });
  await prisma.stockAdjustmentItem.deleteMany({ where: { stockAdjustment: { businessId: business.id } } });
  await prisma.stockAdjustment.deleteMany({ where: { businessId: business.id } });
  await prisma.stock.deleteMany({ where: { productId: product.id } });
  await prisma.product.deleteMany({ where: { id: product.id } });
  await prisma.warehouse.deleteMany({ where: { businessId: business.id } });
  await prisma.business.deleteMany({ where: { id: business.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  console.log("Cleaned up test data.");
}

testRegression().catch(console.error).finally(() => prisma.$disconnect());
