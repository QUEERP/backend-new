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

const getTradingProcurementReport = async (businessId, dateRangeRaw, tab, page = 1, pageSize = 25) => {
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  
  // Custom date handling since dateRange comes from query
  let dateRange = dateRangeRaw;
  if (typeof dateRangeRaw === 'object' && dateRangeRaw !== null) {
    if (dateRangeRaw.startDate && dateRangeRaw.endDate) {
      dateRange = `${dateRangeRaw.startDate},${dateRangeRaw.endDate}`;
    }
  }

  let response = {};

  if (!tab || tab === 'vendors') {
    // KPI Data fetching
    const [
      totalVendors,
      purchaseOrdersAgg,
      billsAgg,
      paymentsAgg,
      returnsAgg,
      prCount,
      grnCount,
      overdueBillsCount
    ] = await Promise.all([
      prisma.vendor.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } }),
      prisma.purchaseOrder.aggregate({ where: { businessId, ...getDateFilter(dateRange, "createdAt") }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.bill.aggregate({ where: { businessId, ...getDateFilter(dateRange, "billDate") }, _sum: { totalAmount: true, outstandingAmount: true }, _count: { id: true } }),
      prisma.payment.aggregate({ where: { businessId, billId: { not: null }, ...getDateFilter(dateRange, "paymentDate") }, _sum: { amount: true }, _count: { id: true } }),
      prisma.purchaseReturn.aggregate({ where: { businessId, ...getDateFilter(dateRange, "createdAt") }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.purchaseRequest.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } }),
      prisma.goodsReceiveNote.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } }),
      prisma.bill.count({ where: { businessId, dueDate: { lt: new Date() }, outstandingAmount: { gt: 0 }, ...getDateFilter(dateRange, "billDate") } })
    ]);

    response.kpis = {
      totalVendors,
      totalPOs: purchaseOrdersAgg._count.id || 0,
      totalPOValue: purchaseOrdersAgg._sum.totalAmount || 0,
      totalBills: billsAgg._count.id || 0,
      totalBillsValue: billsAgg._sum.totalAmount || 0,
      totalPayments: paymentsAgg._count.id || 0,
      totalPaymentsValue: paymentsAgg._sum.amount || 0,
      outstandingValue: billsAgg._sum.outstandingAmount || 0,
      overdueBillsCount
    };

    response.funnel = {
      requests: { count: prCount, value: 0 }, // Value approximation skipped for funnel performance
      pos: { count: response.kpis.totalPOs, value: response.kpis.totalPOValue },
      receipts: { count: grnCount, value: 0 },
      bills: { count: response.kpis.totalBills, value: response.kpis.totalBillsValue },
      payments: { count: response.kpis.totalPayments, value: response.kpis.totalPaymentsValue },
      returns: { count: returnsAgg._count.id || 0, value: returnsAgg._sum.totalAmount || 0 }
    };
  }

  if (!tab || tab === 'vendors') {
    const vendorsRaw = await prisma.vendor.findMany({
      where: { businessId, ...getDateFilter(dateRange, "createdAt") },
      select: { id: true, name: true, createdAt: true },
      take, skip, orderBy: { createdAt: 'desc' }
    });

    const vendorIds = vendorsRaw.map(v => v.id);
    const [billsAgg, paymentsAgg] = await Promise.all([
      prisma.bill.groupBy({
        by: ['vendorId'], where: { vendorId: { in: vendorIds } }, _sum: { totalAmount: true, outstandingAmount: true }
      }),
      prisma.payment.findMany({
        where: { bill: { vendorId: { in: vendorIds } } },
        select: { bill: { select: { vendorId: true } }, amount: true, paymentDate: true }
      })
    ]);

    const billMap = billsAgg.reduce((acc, b) => ({ ...acc, [b.vendorId]: { total: b._sum.totalAmount, out: b._sum.outstandingAmount } }), {});
    
    // Group payments by vendor in JS (since they are only for these vendors, it's small)
    const payMap = {};
    paymentsAgg.forEach(p => {
      const vId = p.bill.vendorId;
      if (!payMap[vId]) payMap[vId] = { total: 0, lastDate: p.paymentDate };
      payMap[vId].total += p.amount || 0;
      if (new Date(p.paymentDate) > new Date(payMap[vId].lastDate)) payMap[vId].lastDate = p.paymentDate;
    });

    response.vendorsList = vendorsRaw.map(v => ({
      id: v.id,
      name: v.name,
      totalBilled: billMap[v.id]?.total || 0,
      totalPaid: payMap[v.id]?.total || 0,
      outstanding: billMap[v.id]?.out || 0,
      lastPaymentDate: payMap[v.id]?.lastDate || null
    }));
    response.vendorsTotalCount = await prisma.vendor.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } });
  }

  if (tab === 'requests') {
    const [purchaseRequestsListRaw, totalCount] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where: { businessId, ...getDateFilter(dateRange, "createdAt") },
        select: {
          id: true, createdAt: true, status: true, requestNumber: true, notes: true,
          requester: { select: { user: { select: { name: true } } } },
          items: { select: { quantity: true, estimatedPrice: true, description: true } },
          project: { select: { projectName: true } }
        },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.purchaseRequest.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } })
    ]);

    response.purchaseRequestsList = purchaseRequestsListRaw.map(pr => {
      const value = pr.items.reduce((sum, item) => sum + (item.quantity * (item.estimatedPrice || 0)), 0);
      const description = pr.items.map(i => i.description).join(', ');
      return {
        id: pr.id, createdAt: pr.createdAt, requestedBy: pr.requester?.user?.name || 'Unknown',
        description, value, status: pr.status, convertedTo: null
      };
    });
    response.requestsTotalCount = totalCount;
  }

  if (tab === 'orders') {
    const [purchaseOrdersList, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { businessId, ...getDateFilter(dateRange, "createdAt") },
        select: {
          id: true, createdAt: true, poNumber: true, vendor: { select: { name: true } },
          totalAmount: true, status: true,
        },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.purchaseOrder.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } })
    ]);
    response.purchaseOrdersList = purchaseOrdersList;
    response.ordersTotalCount = totalCount;
  }

  if (tab === 'receipts') {
    const [receiptsList, totalCount] = await Promise.all([
      prisma.goodsReceiveNote.findMany({
        where: { businessId, ...getDateFilter(dateRange, "createdAt") },
        select: {
          id: true, receivedDate: true, grnNumber: true, vendor: { select: { name: true } },
          purchaseOrder: { select: { poNumber: true } }, status: true,
          items: { select: { quantityReceived: true, product: { select: { name: true } } } }
        },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.goodsReceiveNote.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } })
    ]);
    response.receiptsList = receiptsList.map(r => ({
      id: r.id, date: r.receivedDate, vendor: r.vendor?.name, linkedPo: r.purchaseOrder?.poNumber,
      itemsReceived: r.items.map(i => i.product?.name || 'Unknown Product').join(', '), status: r.status
    }));
    response.receiptsTotalCount = totalCount;
  }

  if (tab === 'bills') {
    const [billsListRaw, totalCount] = await Promise.all([
      prisma.bill.findMany({
        where: { businessId, ...getDateFilter(dateRange, "billDate") },
        select: {
          id: true, billNumber: true, billDate: true, dueDate: true, totalAmount: true,
          outstandingAmount: true, status: true, vendor: { select: { name: true } }
        },
        take, skip, orderBy: { billDate: 'desc' }
      }),
      prisma.bill.count({ where: { businessId, ...getDateFilter(dateRange, "billDate") } })
    ]);
    response.billsList = billsListRaw.map(b => ({
      id: b.id, billNumber: b.billNumber, createdAt: b.billDate, dueDate: b.dueDate,
      grandTotal: b.totalAmount, amountPaid: (b.totalAmount || 0) - (b.outstandingAmount || 0),
      balance: b.outstandingAmount, status: b.status, vendor: b.vendor
    }));
    response.billsTotalCount = totalCount;
  }

  if (tab === 'payments') {
    const [vendorPaymentsListRaw, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { businessId, billId: { not: null }, ...getDateFilter(dateRange, "paymentDate") },
        select: {
          id: true, paymentDate: true, amount: true, amountAllocated: true, status: true,
          paymentMode: true, bill: { select: { vendor: { select: { name: true } } } }
        },
        take, skip, orderBy: { paymentDate: 'desc' }
      }),
      prisma.payment.count({ where: { businessId, billId: { not: null }, ...getDateFilter(dateRange, "paymentDate") } })
    ]);
    response.vendorPaymentsList = vendorPaymentsListRaw.map(p => ({
      id: p.id, paymentDate: p.paymentDate, amount: p.amount, amountAllocated: p.amountAllocated,
      status: p.status, paymentMode: p.paymentMode, vendor: p.bill?.vendor
    }));
    response.paymentsTotalCount = totalCount;
  }

  if (tab === 'returns') {
    const [returnsList, totalCount] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where: { businessId, ...getDateFilter(dateRange, "createdAt") },
        select: {
          id: true, createdAt: true, reason: true, totalAmount: true,
          vendor: { select: { name: true } }, bill: { select: { billNumber: true } },
          grn: { select: { grnNumber: true } }
        },
        take, skip, orderBy: { createdAt: 'desc' }
      }),
      prisma.purchaseReturn.count({ where: { businessId, ...getDateFilter(dateRange, "createdAt") } })
    ]);
    response.returnsList = returnsList.map(r => ({
      id: r.id, date: r.createdAt, vendor: r.vendor?.name, linkedSource: r.bill?.billNumber || r.grn?.grnNumber,
      reason: r.reason, amount: r.totalAmount
    }));
    response.returnsTotalCount = totalCount;
  }

  return response;
};

module.exports = {
  getTradingProcurementReport
};
