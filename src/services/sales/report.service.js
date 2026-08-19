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


const getSalesDashboard = async (businessId) => {
  const now = new Date();

  // 1. Invoice billing summaries (grouped by status)
  const billingSummary = await prisma.invoice.groupBy({
    by: ["status"],
    where: { businessId, isDeleted: false },
    _sum: {
      grandTotal: true,
      subtotal: true
    },
    _count: {
      id: true
    }
  });

  // 2. Outstanding overdue invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      businessId,
      isDeleted: false,
      status: { in: ["UNPAID", "PARTIALLY_PAID", "SENT"] },
      dueDate: { lt: now }
    },
    include: {
      customer: {
        select: {
          id: true,
          company: true,
          phone: true
        }
      }
    },
    orderBy: { dueDate: "asc" },
    take: 10
  });

  // 3. Sales Funnel analytics (quotations conversion status)
  const quoteFunnel = await prisma.quotation.groupBy({
    by: ["status"],
    where: { businessId, isDeleted: false },
    _sum: {
      totalAmount: true
    },
    _count: {
      id: true
    }
  });

  // 4. Sales Order tracking
  const salesOrderTracking = await prisma.salesOrder.groupBy({
    by: ["status"],
    where: { businessId, isDeleted: false },
    _sum: {
      totalAmount: true
    },
    _count: {
      id: true
    }
  });

  // 5. Top-performing customers (Top 5 by gross billings)
  const topCustomersRaw = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: { businessId, isDeleted: false },
    _sum: {
      grandTotal: true
    },
    orderBy: {
      _sum: {
        grandTotal: "desc"
      }
    },
    take: 5
  });

  const topCustomers = [];
  for (const item of topCustomersRaw) {
    if (item.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: item.customerId },
        select: { company: true }
      });
      topCustomers.push({
        customerId: item.customerId,
        name: customer ? customer.company : "Deleted Customer",
        company: customer ? customer.company : null,
        totalSales: item._sum.grandTotal || 0
      });
    }
  }

  // 6. Top selling products (Top 5 by aggregate revenues)
  const topProductsRaw = await prisma.invoiceItem.groupBy({
    by: ["productId", "description"],
    where: {
      invoice: { businessId, isDeleted: false }
    },
    _sum: {
      totalAmount: true,
      quantity: true
    },
    orderBy: {
      _sum: {
        totalAmount: "desc"
      }
    },
    take: 5
  });

  const topProducts = topProductsRaw.map((item) => ({
    productId: item.productId,
    description: item.description,
    totalRevenue: item._sum.totalAmount || 0,
    totalQuantity: item._sum.quantity || 0
  }));

  // 7. Recent Sales Actions (Audit logs)
  const recentLogs = await prisma.auditLog.findMany({
    where: { businessId, module: "SALES" },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return {
    billingSummary,
    overdueInvoices,
    quoteFunnel,
    salesOrderTracking,
    topCustomers,
    topProducts,
    recentLogs
  };
};


const getBasicSalesReport = async (businessId, dateRange) => {
  // 1. Total customers
  const totalCustomers = await prisma.customer.count({
    where: { businessId, isDeleted: false }
  });

  // 2. Total payments (made / received)
  const payments = await prisma.payment.aggregate({
    where: { businessId },
    _sum: {
      amount: true,
      amountAllocated: true
    }
  });

  const totalPaymentsMade = payments._sum.amount || 0;
  const paymentsAllocated = payments._sum.amountAllocated || 0;
  const paymentsRemaining = totalPaymentsMade - paymentsAllocated;

  // 3. Total Credit note
  const creditNotes = await prisma.creditNote.aggregate({
    where: { businessId },
    _sum: {
      amount: true
    }
  });

  const totalCreditNotes = creditNotes._sum.amount || 0;

  // 4. Detailed lists for tables (limit 1000)
  const customersListRaw = await prisma.customer.findMany({
    where: { businessId, isDeleted: false },
    select: {
      id: true,
      company: true,
      phone: true,
      createdAt: true,
      customerContacts: {
        select: { email: true },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000
  });

  const customersList = customersListRaw.map(c => ({
    id: c.id,
    company: c.company,
    phone: c.phone,
    email: c.customerContacts?.[0]?.email || null,
    createdAt: c.createdAt
  }));

  const paymentsList = await prisma.payment.findMany({
    where: { businessId },
    select: {
      id: true,
      paymentDate: true,
      amount: true,
      amountAllocated: true,
      status: true,
      paymentMode: true,
      customer: {
        select: {
          company: true
        }
      },
      project: {
        select: {
          projectName: true
        }
      }
    },
    orderBy: { paymentDate: 'desc' },
    take: 1000
  });

  const creditNotesList = await prisma.creditNote.findMany({
    where: { businessId },
    select: {
      id: true,
      createdAt: true,
      amount: true,
      remainingAmount: true,
      status: true,
      customer: {
        select: {
          company: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000
  });

  return {
    totalCustomers,
    totalPaymentsMade,
    paymentsAllocated,
    paymentsRemaining,
    totalCreditNotes,
    customersList,
    paymentsList,
    creditNotesList
  };
};

const getTradingSalesReport = async (businessId, dateRangeRaw, tab, page = 1, pageSize = 25) => {
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  
  // Custom date handling since dateRange comes from query
  let dateRange = dateRangeRaw;
  if (typeof dateRangeRaw === 'object' && dateRangeRaw !== null) {
    if (dateRangeRaw.startDate && dateRangeRaw.endDate) {
      dateRange = `${dateRangeRaw.startDate},${dateRangeRaw.endDate}`;
    }
  }

  const dateFilter = getDateFilter(dateRange, 'createdAt');
  const invoiceDateFilter = getDateFilter(dateRange, 'invoiceDate');
  const paymentDateFilter = getDateFilter(dateRange, 'paymentDate');

  let response = {};

  // Fetch KPIs if not fetching a specific tab or fetching the default tab
  if (!tab || tab === 'payments') {
    const totalCustomers = await prisma.customer.count({
      where: { businessId, isDeleted: false, ...dateFilter }
    });

    const paymentsAgg = await prisma.payment.aggregate({
      where: { businessId, customerId: { not: null }, ...paymentDateFilter },
      _sum: {
        amount: true,
        amountAllocated: true
      }
    });
    const totalPaymentsMade = paymentsAgg._sum.amount || 0;
    const paymentsAllocated = paymentsAgg._sum.amountAllocated || 0;
    const paymentsRemaining = totalPaymentsMade - paymentsAllocated;

    const creditNotesAgg = await prisma.creditNote.aggregate({
      where: { businessId, isDeleted: false, customerId: { not: null }, ...dateFilter },
      _sum: {
        amount: true
      }
    });
    const totalCreditNotes = creditNotesAgg._sum.amount || 0;

    response = {
      ...response,
      totalCustomers,
      totalPaymentsMade,
      paymentsAllocated,
      paymentsRemaining,
      totalCreditNotes
    };
  }

  // Fetch paginated tab data
  if (!tab || tab === 'payments') {
    const [paymentsList, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { businessId, customerId: { not: null }, ...paymentDateFilter },
        select: {
          id: true, paymentDate: true, amount: true, amountAllocated: true,
          status: true, paymentMode: true,
          customer: { select: { company: true } },
          project: { select: { projectName: true } }
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take
      }),
      prisma.payment.count({ where: { businessId, customerId: { not: null }, ...paymentDateFilter } })
    ]);
    response.paymentsList = paymentsList;
    response.paymentsTotalCount = totalCount;
  }

  if (tab === 'customers') {
    const customersRaw = await prisma.customer.findMany({
      where: { businessId, isDeleted: false, ...dateFilter },
      select: {
        id: true, company: true, phone: true, createdAt: true,
        customerContacts: { select: { email: true }, take: 1 }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });

    // Bulk fetch aggregations for these specific customers to avoid N+1
    const customerIds = customersRaw.map(c => c.id);
    const [invoicesAgg, paymentsAgg] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, isDeleted: false },
        _sum: { grandTotal: true }
      }),
      prisma.payment.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds } },
        _sum: { amount: true }
      })
    ]);

    const invMap = invoicesAgg.reduce((acc, curr) => ({ ...acc, [curr.customerId]: curr._sum.grandTotal || 0 }), {});
    const payMap = paymentsAgg.reduce((acc, curr) => ({ ...acc, [curr.customerId]: curr._sum.amount || 0 }), {});

    const customersList = customersRaw.map(c => {
      const totalInvoiced = invMap[c.id] || 0;
      const totalPaid = payMap[c.id] || 0;
      return {
        id: c.id,
        company: c.company,
        phone: c.phone,
        email: c.customerContacts?.[0]?.email || null,
        createdAt: c.createdAt,
        totalInvoiced,
        totalPaid,
        outstanding: totalInvoiced - totalPaid,
        lastPaymentDate: null
      };
    });

    const totalCount = await prisma.customer.count({ where: { businessId, isDeleted: false, ...dateFilter } });
    response.customersList = customersList;
    response.customersTotalCount = totalCount;
  }

  if (tab === 'credit-notes') {
    const [creditNotesList, totalCount] = await Promise.all([
      prisma.creditNote.findMany({
        where: { businessId, isDeleted: false, customerId: { not: null }, ...dateFilter },
        select: {
          id: true, createdAt: true, amount: true, remainingAmount: true,
          status: true, reason: true,
          customer: { select: { company: true } },
          invoice: { select: { invoiceNumber: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.creditNote.count({ where: { businessId, isDeleted: false, customerId: { not: null }, ...dateFilter } })
    ]);
    response.creditNotesList = creditNotesList;
    response.creditNotesTotalCount = totalCount;
  }

  if (tab === 'quotations') {
    const quotationsRaw = await prisma.quotation.findMany({
      where: { businessId, ...dateFilter },
      select: {
        id: true, quoteNumber: true, createdAt: true, totalAmount: true,
        status: true, customer: { select: { company: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip, take
    });

    // Find linked SOs efficiently
    const quotationIds = quotationsRaw.map(q => q.id);
    const linkedSOs = await prisma.salesOrder.findMany({
      where: { quotationId: { in: quotationIds }, businessId },
      select: { quotationId: true, orderNumber: true }
    });
    const soMap = linkedSOs.reduce((acc, so) => ({ ...acc, [so.quotationId]: so.orderNumber }), {});

    const quotationsList = quotationsRaw.map(q => ({
      ...q,
      convertedTo: soMap[q.id] || null
    }));

    const totalCount = await prisma.quotation.count({ where: { businessId, ...dateFilter } });
    response.quotationsList = quotationsList;
    response.quotationsTotalCount = totalCount;
  }

  if (tab === 'sales-orders') {
    const [salesOrdersList, totalCount] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { businessId, ...dateFilter },
        select: {
          id: true, orderNumber: true, createdAt: true, totalAmount: true,
          status: true, quotationId: true,
          customer: { select: { company: true } },
          quotation: { select: { quoteNumber: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take
      }),
      prisma.salesOrder.count({ where: { businessId, ...dateFilter } })
    ]);
    response.salesOrdersList = salesOrdersList;
    response.salesOrdersTotalCount = totalCount;
  }

  if (tab === 'invoices') {
    const [invoicesRaw, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where: { businessId, isDeleted: false, ...invoiceDateFilter },
        select: {
          id: true, invoiceNumber: true, invoiceDate: true, dueDate: true,
          grandTotal: true, status: true, customer: { select: { company: true } }
        },
        orderBy: { invoiceDate: 'desc' },
        skip, take
      }),
      prisma.invoice.count({ where: { businessId, isDeleted: false, ...invoiceDateFilter } })
    ]);

    const invoicesList = invoicesRaw.map(inv => ({
      ...inv,
      paidAmount: inv.status === "PAID" ? inv.grandTotal : 0,
      balance: inv.grandTotal - (inv.status === "PAID" ? inv.grandTotal : 0)
    }));
    response.invoicesList = invoicesList;
    response.invoicesTotalCount = totalCount;
  }

  if (tab === 'returns') {
    const [returnsList, totalCount] = await Promise.all([
      prisma.salesReturn.findMany({
        where: { businessId, ...dateFilter },
        select: {
          id: true, returnNumber: true, createdAt: true, totalAmount: true,
          reason: true, status: true,
          customer: { select: { company: true } },
          invoice: { select: { invoiceNumber: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take
      }),
      prisma.salesReturn.count({ where: { businessId, ...dateFilter } })
    ]);
    response.returnsList = returnsList;
    response.returnsTotalCount = totalCount;
  }

  if (tab === 'recurring') {
    const [recurringList, totalCount] = await Promise.all([
      prisma.recurringInvoice.findMany({
        where: { businessId },
        select: {
          id: true, profileName: true, frequency: true, nextInvoiceDate: true,
          grandTotal: true, status: true,
          customer: { select: { company: true } }
        },
        orderBy: { nextInvoiceDate: 'asc' },
        skip, take
      }),
      prisma.recurringInvoice.count({ where: { businessId } })
    ]);
    response.recurringList = recurringList;
    response.recurringTotalCount = totalCount;
  }

  return response;
};

module.exports = {
  getSalesDashboard,
  getBasicSalesReport,
  getTradingSalesReport
};
