const prisma = require("../../config/prisma");

const getProjectOperationsReport = async (businessId, dateRangeRaw, tab, page = 1, pageSize = 25) => {
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  
  let dateRange = dateRangeRaw;
  if (typeof dateRangeRaw === 'object' && dateRangeRaw !== null) {
    if (dateRangeRaw.startDate && dateRangeRaw.endDate) {
      dateRange = { startDate: dateRangeRaw.startDate, endDate: dateRangeRaw.endDate };
    }
  }

  const { startDate, endDate } = dateRange || {};
  
  const dateFilter = startDate && endDate ? {
    createdAt: {
      gte: new Date(startDate),
      lte: new Date(endDate),
    }
  } : {};

  let response = { lists: {} };

  if (!tab || tab === 'projects') {
    // KPIs
    const [
      totalProjects,
      openIssues,
      expenses,
      payments,
      allProjectsForProfit
    ] = await Promise.all([
      prisma.project.count({ where: { businessId, status: { notIn: ['COMPLETED', 'ON_HOLD'] } } }),
      prisma.projectIssue.count({ where: { project: { businessId }, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.expense.aggregate({
        where: { businessId, projectId: { not: null }, ...(startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate) } } : {}) },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { businessId, projectId: { not: null }, ...(startDate && endDate ? { paymentDate: { gte: new Date(startDate), lte: new Date(endDate) } } : {}) },
        _sum: { amount: true }
      }),
      prisma.project.findMany({ where: { businessId }, select: { revenue: true, actualCost: true } })
    ]);

    const totalExpenses = expenses._sum.amount || 0;
    const revenueCollected = payments._sum.amount || 0;
    let totalRev = 0;
    let totalCost = 0;
    allProjectsForProfit.forEach(p => {
      totalRev += p.revenue || 0;
      totalCost += p.actualCost || 0;
    });
    let profitability = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;

    response.kpis = { totalProjects, openIssues, totalExpenses, revenueCollected, profitability };

    // Funnel
    const [
      requirementsCount, estimationsCount, projectsWonCount,
      estimationsVal, projectsVal, changeRequestsCount,
      warrantiesCount, amcCount, ticketsCount
    ] = await Promise.all([
      prisma.projectRequirement.count({ where: { businessId } }),
      prisma.projectEstimation.count({ where: { businessId } }),
      prisma.project.count({ where: { businessId } }),
      prisma.projectEstimation.aggregate({ where: { businessId }, _sum: { totalCost: true } }),
      prisma.project.aggregate({ where: { businessId }, _sum: { budget: true } }),
      prisma.projectChangeRequest.count({ where: { project: { businessId } } }),
      prisma.warranty.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.aMC.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.ticket.count({ where: { businessId, status: { not: 'CLOSED' } } })
    ]);

    response.funnel = {
      requirements: { count: requirementsCount, value: 0 },
      estimations: { count: estimationsCount, value: estimationsVal._sum?.totalCost || 0 },
      projects: { count: projectsWonCount, value: projectsVal._sum?.budget || 0 },
      changeRequests: { count: changeRequestsCount, value: 0 },
      support: { warrantyActive: warrantiesCount, amcActive: amcCount, ticketsOpen: ticketsCount }
    };
  }

  if (!tab || tab === 'projects') {
    const [projectsListRaw, totalCount] = await Promise.all([
      prisma.project.findMany({
        where: { businessId },
        select: { id: true, projectName: true, customerId: true, status: true, budget: true, actualCost: true, createdAt: true, revenue: true },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.project.count({ where: { businessId } })
    ]);
    response.lists.projects = projectsListRaw.map(p => ({
      ...p, profitability: p.revenue ? ((p.revenue - p.actualCost) / p.revenue) * 100 : 0
    }));
    response.lists.projectsTotalCount = totalCount;
  }

  if (tab === 'tasks') {
    const [tasksList, totalCount] = await Promise.all([
      prisma.projectTask.findMany({
        where: { project: { businessId } },
        select: { id: true, title: true, status: true, dueDate: true, project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.projectTask.count({ where: { project: { businessId } } })
    ]);
    response.lists.tasks = tasksList;
    response.lists.tasksTotalCount = totalCount;
  }

  if (tab === 'milestones') {
    const [milestonesList, totalCount] = await Promise.all([
      prisma.projectMilestone.findMany({
        where: { project: { businessId } },
        select: { id: true, name: true, status: true, dueDate: true, project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.projectMilestone.count({ where: { project: { businessId } } })
    ]);
    response.lists.milestones = milestonesList;
    response.lists.milestonesTotalCount = totalCount;
  }

  if (tab === 'issues') {
    const [issuesList, totalCount] = await Promise.all([
      prisma.projectIssue.findMany({
        where: { project: { businessId } },
        select: { id: true, title: true, status: true, priority: true, project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.projectIssue.count({ where: { project: { businessId } } })
    ]);
    response.lists.issues = issuesList;
    response.lists.issuesTotalCount = totalCount;
  }

  if (tab === 'changeRequests') {
    const [changeRequestsList, totalCount] = await Promise.all([
      prisma.projectChangeRequest.findMany({
        where: { project: { businessId } },
        select: { id: true, title: true, status: true, createdAt: true, project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.projectChangeRequest.count({ where: { project: { businessId } } })
    ]);
    response.lists.changeRequests = changeRequestsList;
    response.lists.changeRequestsTotalCount = totalCount;
  }

  if (tab === 'expenses') {
    const [expensesList, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where: { businessId, projectId: { not: null } },
        select: { id: true, date: true, amount: true, category: true, status: true, project: { select: { projectName: true } } },
        orderBy: { date: 'desc' }, take, skip
      }),
      prisma.expense.count({ where: { businessId, projectId: { not: null } } })
    ]);
    response.lists.expenses = expensesList;
    response.lists.expensesTotalCount = totalCount;
  }

  if (tab === 'billing') {
    const [billingList, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where: { businessId, projectId: { not: null }, isDeleted: false },
        select: { id: true, invoiceDate: true, grandTotal: true, status: true, customer: { select: { company: true } }, project: { select: { projectName: true } } },
        orderBy: { invoiceDate: 'desc' }, take, skip
      }),
      prisma.invoice.count({ where: { businessId, projectId: { not: null }, isDeleted: false } })
    ]);
    response.lists.billing = billingList;
    response.lists.billingTotalCount = totalCount;
  }

  if (tab === 'warranty') {
    const [warrantyList, totalCount] = await Promise.all([
      prisma.warranty.findMany({
        where: { businessId },
        select: { id: true, startDate: true, endDate: true, status: true, project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.warranty.count({ where: { businessId } })
    ]);
    response.lists.warranty = warrantyList;
    response.lists.warrantyTotalCount = totalCount;
  }

  if (tab === 'tickets') {
    const [ticketsList, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where: { businessId },
        select: { id: true, subject: true, priority: true, status: true, createdAt: true, project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.ticket.count({ where: { businessId } })
    ]);
    response.lists.tickets = ticketsList;
    response.lists.ticketsTotalCount = totalCount;
  }

  return response;
};

module.exports = {
  getProjectOperationsReport
};
