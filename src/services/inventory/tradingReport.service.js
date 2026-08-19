const prisma = require("../../config/prisma");

const getDateFilter = (dateRange, dateField = 'createdAt') => {
  if (!dateRange || dateRange === 'all_time') return {};
  
  const now = new Date();
  const filter = {};
  
  if (dateRange === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filter[dateField] = { gte: startOfMonth };
  } else if (dateRange === 'last_quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const startOfLastQuarter = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    const endOfLastQuarter = new Date(now.getFullYear(), currentQuarter * 3, 0, 23, 59, 59, 999);
    filter[dateField] = { gte: startOfLastQuarter, lte: endOfLastQuarter };
  } else if (dateRange.includes(',')) {
    const [start, end] = dateRange.split(',');
    if (start && end) {
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      filter[dateField] = { gte: startDate, lte: endDate };
    }
  }
  return filter;
};

exports.getTradingInventoryReport = async (businessId, dateRangeRaw, tab, page = 1, pageSize = 25) => {
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  
  let dateRange = dateRangeRaw;
  if (typeof dateRangeRaw === 'object' && dateRangeRaw !== null) {
    if (dateRangeRaw.startDate && dateRangeRaw.endDate) {
      dateRange = `${dateRangeRaw.startDate},${dateRangeRaw.endDate}`;
    }
  }

  const dateFilter = getDateFilter(dateRange, 'createdAt');
  const movementDateFilter = getDateFilter(dateRange, 'createdAt');

  let response = {};

  if (!tab || tab === 'products') {
    // KPI Data fetching
    const [
      totalProducts,
      activeWarehouses,
      stockMovementsCount,
      allStocks
    ] = await Promise.all([
      prisma.product.count({ where: { businessId, isActive: true, ...dateFilter } }),
      prisma.warehouse.count({ where: { businessId, ...dateFilter } }),
      prisma.stockMovement.count({ where: { businessId, ...movementDateFilter } }),
      prisma.stock.findMany({ where: { warehouse: { businessId } }, include: { product: true } })
    ]);

    let totalStockValue = 0;
    let lowStockCount = 0;
    const productStockMap = new Map();

    for (const stock of allStocks) {
      if (stock.quantity > 0) {
        totalStockValue += stock.quantity * (stock.product.costPrice || stock.product.price || 0);
      }
      const current = productStockMap.get(stock.productId) || 0;
      productStockMap.set(stock.productId, current + stock.quantity);
    }

    const funnelMovements = await prisma.stockMovement.groupBy({
      by: ['type'],
      where: { businessId, ...movementDateFilter },
      _count: { _all: true },
      _sum: { quantity: true }
    });

    let receiptsCount = 0, receiptsQty = 0;
    let transfersCount = 0, transfersQty = 0;
    let adjustmentsCount = 0, adjustmentsQty = 0;
    let stockOutCount = 0, stockOutQty = 0;

    funnelMovements.forEach(m => {
      const count = m._count._all || 0;
      const qty = m._sum.quantity || 0;
      if (m.type === 'PURCHASE_IN') {
        receiptsCount += count; receiptsQty += qty;
      } else if (m.type === 'TRANSFER_IN' || m.type === 'TRANSFER_OUT') {
        transfersCount += count; transfersQty += Math.abs(qty);
      } else if (m.type === 'ADJUSTMENT_IN' || m.type === 'ADJUSTMENT_OUT') {
        adjustmentsCount += count; adjustmentsQty += Math.abs(qty);
      } else if (m.type === 'SALE_OUT') {
        stockOutCount += count; stockOutQty += Math.abs(qty);
      }
    });

    transfersCount = Math.floor(transfersCount / 2);
    transfersQty = transfersQty / 2;

    response.kpis = {
      totalProducts,
      totalStockValue,
      lowStockCount: 0, // Will calculate based on paginated products or global
      activeWarehouses,
      stockMovementsCount
    };

    response.funnel = {
      receipts: { count: receiptsCount, quantity: receiptsQty },
      transfers: { count: transfersCount, quantity: transfersQty },
      adjustments: { count: adjustmentsCount, quantity: adjustmentsQty },
      stockOut: { count: stockOutCount, quantity: stockOutQty }
    };
    
    // Pass map to response temporarily if needed later for products
    response._productStockMap = productStockMap;
  }

  // Pre-fetch product map for other tabs if they need stock counts
  // For paginated APIs, we only need to map stocks for the fetched items
  const getPaginatedProductStockMap = async (productIds) => {
    const stocks = await prisma.stock.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, warehouse: { businessId } },
      _sum: { quantity: true }
    });
    return stocks.reduce((acc, s) => ({ ...acc, [s.productId]: s._sum.quantity || 0 }), {});
  };

  if (!tab || tab === 'products') {
    const [productsRaw, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: { businessId, ...dateFilter },
        include: { category: true, brand: true, productUnit: true },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where: { businessId, ...dateFilter } })
    ]);
    
    const pStockMap = response._productStockMap || await getPaginatedProductStockMap(productsRaw.map(p => p.id));

    response.productsList = productsRaw.map(p => {
      const qty = pStockMap instanceof Map ? (pStockMap.get(p.id) || 0) : (pStockMap[p.id] || 0);
      return {
        name: p.name,
        sku: p.sku,
        category: p.category?.name || 'N/A',
        brand: p.brand?.name || 'N/A',
        unit: p.productUnit?.name || p.unit || 'pcs',
        currentStock: qty,
        reorderLevel: p.reorderLevel,
        status: qty === 0 ? 'Out of stock' : (qty <= p.reorderLevel ? 'Low' : 'In stock')
      };
    });
    response.productsTotalCount = totalCount;
    delete response._productStockMap;
  }

  if (tab === 'categories') {
    const [categoriesRaw, totalCount] = await Promise.all([
      prisma.category.findMany({ 
        where: { businessId, ...dateFilter }, 
        include: { products: true },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.category.count({ where: { businessId, ...dateFilter } })
    ]);
    const pIds = categoriesRaw.flatMap(c => c.products.map(p => p.id));
    const stocks = await prisma.stock.findMany({ where: { productId: { in: pIds } }, include: { product: true } });
    
    response.categoriesList = categoriesRaw.map(c => {
      let value = 0;
      c.products.forEach(p => {
        const pStocks = stocks.filter(s => s.productId === p.id);
        const qty = pStocks.reduce((sum, s) => sum + s.quantity, 0);
        if (qty > 0) value += qty * (p.costPrice || p.price || 0);
      });
      return { name: c.name, productCount: c.products.length, totalStockValue: value };
    });
    response.categoriesTotalCount = totalCount;
  }

  if (tab === 'brands') {
    const [brandsRaw, totalCount] = await Promise.all([
      prisma.brand.findMany({ 
        where: { businessId, ...dateFilter }, 
        include: { products: true },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.brand.count({ where: { businessId, ...dateFilter } })
    ]);
    const pIds = brandsRaw.flatMap(b => b.products.map(p => p.id));
    const stocks = await prisma.stock.findMany({ where: { productId: { in: pIds } }, include: { product: true } });
    
    response.brandsList = brandsRaw.map(b => {
      let value = 0;
      b.products.forEach(p => {
        const pStocks = stocks.filter(s => s.productId === p.id);
        const qty = pStocks.reduce((sum, s) => sum + s.quantity, 0);
        if (qty > 0) value += qty * (p.costPrice || p.price || 0);
      });
      return { name: b.name, productCount: b.products.length, totalStockValue: value };
    });
    response.brandsTotalCount = totalCount;
  }

  if (tab === 'units') {
    const [unitsRaw, totalCount] = await Promise.all([
      prisma.unit.findMany({ 
        where: { businessId, ...dateFilter }, 
        include: { products: true },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.unit.count({ where: { businessId, ...dateFilter } })
    ]);
    response.unitsList = unitsRaw.map(u => ({
      name: u.name, abbreviation: u.name, productsUsingIt: u.products.length
    }));
    response.unitsTotalCount = totalCount;
  }

  if (tab === 'warehouses') {
    const [warehousesRaw, totalCount] = await Promise.all([
      prisma.warehouse.findMany({ 
        where: { businessId, ...dateFilter },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.warehouse.count({ where: { businessId, ...dateFilter } })
    ]);
    const wIds = warehousesRaw.map(w => w.id);
    const stocks = await prisma.stock.findMany({ where: { warehouseId: { in: wIds } }, include: { product: true } });
    
    response.warehousesList = warehousesRaw.map(w => {
      const wStocks = stocks.filter(s => s.warehouseId === w.id);
      let value = 0;
      const productsStored = new Set(wStocks.map(s => s.productId)).size;
      wStocks.forEach(s => {
        if (s.quantity > 0) value += s.quantity * (s.product.costPrice || s.product.price || 0);
      });
      return { name: w.name, productsStored, totalValue: value, utilization: 'N/A' };
    });
    response.warehousesTotalCount = totalCount;
  }

  if (tab === 'stock-overview') {
    const [stockOverviewRaw, totalCount] = await Promise.all([
      prisma.stock.findMany({
        where: { warehouse: { businessId }, ...dateFilter },
        include: { product: true, warehouse: true },
        take, skip, orderBy: { quantity: 'desc' }
      }),
      prisma.stock.count({ where: { warehouse: { businessId }, ...dateFilter } })
    ]);
    response.stockOverviewList = stockOverviewRaw.map(s => ({
      productName: s.product.name,
      warehouseName: s.warehouse?.name || 'Unknown',
      quantityOnHand: s.quantity,
      value: s.quantity > 0 ? (s.quantity * (s.product.costPrice || s.product.price || 0)) : 0
    }));
    response.stockOverviewTotalCount = totalCount;
  }

  if (tab === 'transfers') {
    const [transfersRaw, totalCount] = await Promise.all([
      prisma.stockTransfer.findMany({
        where: { businessId, ...getDateFilter(dateRange, 'transferDate') },
        include: { fromWarehouse: true, toWarehouse: true, items: { include: { product: true } } },
        take, skip, orderBy: { transferDate: 'desc' }
      }),
      prisma.stockTransfer.count({ where: { businessId, ...getDateFilter(dateRange, 'transferDate') } })
    ]);
    response.transfersList = transfersRaw.flatMap(t => t.items.map(i => ({
      date: t.transferDate, productName: i.product.name,
      fromWarehouse: t.fromWarehouse?.name || 'Unknown', toWarehouse: t.toWarehouse?.name || 'Unknown',
      quantity: i.quantity, status: 'Complete'
    })));
    response.transfersTotalCount = totalCount;
  }

  if (tab === 'adjustments') {
    const [adjustmentsRaw, totalCount] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where: { businessId, ...getDateFilter(dateRange, 'adjustmentDate') },
        include: { warehouse: true, items: { include: { product: true } } },
        take, skip, orderBy: { adjustmentDate: 'desc' }
      }),
      prisma.stockAdjustment.count({ where: { businessId, ...getDateFilter(dateRange, 'adjustmentDate') } })
    ]);
    response.adjustmentsList = adjustmentsRaw.flatMap(a => a.items.map(i => ({
      date: a.adjustmentDate, productName: i.product.name,
      warehouse: a.warehouse?.name || 'Unknown', quantityChange: (i.type === 'ADD' ? '+' : '-') + i.quantity,
      reason: a.reason || 'N/A', performedBy: 'System'
    })));
    response.adjustmentsTotalCount = totalCount;
  }

  if (tab === 'movements') {
    const [movementHistoryRaw, totalCount] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { businessId, ...movementDateFilter },
        include: { product: true, warehouse: true },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.stockMovement.count({ where: { businessId, ...movementDateFilter } })
    ]);
    response.movementHistoryList = movementHistoryRaw.map(m => ({
      date: m.createdAt, type: m.type, productName: m.product?.name,
      warehouse: m.warehouse?.name || 'Unknown', quantity: m.quantity, performedBy: m.performedBy || 'System'
    }));
    response.movementsTotalCount = totalCount;
  }

  if (tab === 'alerts') {
    // Reorder alerts require querying products with low stock. 
    // We can just fetch products that have stock <= reorderLevel.
    // For pagination, we query products and filter out those that don't need reorder. 
    // It's a bit complex with Prisma since stock is in another table. We'll fetch a batch.
    const allProducts = await prisma.product.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, sku: true, reorderLevel: true }
    });
    
    const allProductIds = allProducts.map(p => p.id);
    const stocks = await prisma.stock.groupBy({
        by: ['productId'], where: { productId: { in: allProductIds }, warehouse: { businessId } },
        _sum: { quantity: true }
    });
    
    const stockMap = stocks.reduce((acc, s) => ({ ...acc, [s.productId]: s._sum.quantity || 0 }), {});
    
    const alerts = [];
    allProducts.forEach(p => {
        const qty = stockMap[p.id] || 0;
        if (qty <= p.reorderLevel) {
            alerts.push({
                id: p.id, name: p.name, sku: p.sku, currentStock: qty,
                reorderLevel: p.reorderLevel, shortfall: p.reorderLevel - qty,
                status: qty === 0 ? 'Out of stock' : 'Low'
            });
        }
    });
    
    // Sort and paginate
    alerts.sort((a, b) => b.shortfall - a.shortfall);
    
    response.reorderAlertsList = alerts.slice(skip, skip + take);
    response.alertsTotalCount = alerts.length;
    
    if (response.kpis) {
        response.kpis.lowStockCount = alerts.length;
    }
  }

  return response;
};
