const prisma = require("../config/prisma");

const getTradingHRReport = async (businessId, dateRangeRaw, tab, page = 1, pageSize = 25) => {
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

  const attendanceDateFilter = startDate && endDate ? {
    date: {
      gte: new Date(startDate),
      lte: new Date(endDate),
    }
  } : {};

  let response = { lists: {} };

  if (!tab || tab === 'employees') {
    // KPIs
    const [
      totalHeadcount,
      pendingLeaveRequests,
      payslipsAgg,
      overtimeAgg,
      loansAgg,
      loansCount
    ] = await Promise.all([
      prisma.employee.count({ where: { businessId } }),
      prisma.leave.count({ where: { businessId, status: 'PENDING' } }),
      prisma.payslip.aggregate({
        where: { employee: { businessId }, ...dateFilter },
        _sum: { netSalary: true }
      }),
      prisma.overtime.aggregate({
        where: { businessId, ...(startDate && endDate ? { date: attendanceDateFilter.date } : {}) },
        _sum: { overtimeHours: true }
      }),
      prisma.loan.aggregate({
        where: { businessId, ...dateFilter },
        _sum: { remainingAmount: true }
      }),
      prisma.loan.count({ where: { businessId, status: 'active', ...dateFilter } })
    ]);

    response.kpis = {
      totalHeadcount,
      pendingLeaveRequests,
      payrollThisPeriod: payslipsAgg._sum.netSalary || 0,
      overtimeHours: overtimeAgg._sum.overtimeHours || 0,
      openLoansCount: loansCount,
      openLoansBalance: loansAgg._sum.remainingAmount || 0
    };
  }

  // TAB: employees
  if (!tab || tab === 'employees') {
    const [employeesList, totalCount] = await Promise.all([
      prisma.employee.findMany({
        where: { businessId, ...dateFilter },
        select: { id: true, name: true, designation: true, joinDate: true, Code: true },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.employee.count({ where: { businessId, ...dateFilter } })
    ]);
    response.lists.employees = employeesList.map(e => ({
      ...e, status: 'Active' // Simple mock for status as it's not in schema
    }));
    response.lists.employeesTotalCount = totalCount;
  }

  // TAB: attendance
  if (tab === 'attendance') {
    const [attendanceList, totalCount] = await Promise.all([
      prisma.attendance.findMany({
        where: { businessId, ...attendanceDateFilter },
        select: { id: true, date: true, checkIn: true, checkOut: true, status: true, employee: { select: { name: true } } },
        orderBy: { date: 'desc' }, take, skip
      }),
      prisma.attendance.count({ where: { businessId, ...attendanceDateFilter } })
    ]);
    response.lists.attendance = attendanceList;
    response.lists.attendanceTotalCount = totalCount;
  }

  // TAB: leave-management
  if (tab === 'leave-management') {
    const [leaveList, totalCount] = await Promise.all([
      prisma.leave.findMany({
        where: { businessId, ...(startDate && endDate ? { date: attendanceDateFilter.date } : {}) },
        select: { id: true, date: true, duration: true, leaveCode: true, status: true, employee: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.leave.count({ where: { businessId, ...(startDate && endDate ? { date: attendanceDateFilter.date } : {}) } })
    ]);
    response.lists.leaveManagement = leaveList;
    response.lists.leaveManagementTotalCount = totalCount;
  }

  // TAB: payroll
  if (tab === 'payroll') {
    const [payrollList, totalCount] = await Promise.all([
      prisma.payslip.findMany({
        where: { employee: { businessId }, ...dateFilter },
        select: { id: true, basicSalary: true, allowance: true, deduction: true, netSalary: true, status: true, employeeName: true, payroll: { select: { month: true, year: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.payslip.count({ where: { employee: { businessId }, ...dateFilter } })
    ]);
    response.lists.payroll = payrollList;
    response.lists.payrollTotalCount = totalCount;
  }

  // TAB: overtime
  if (tab === 'overtime') {
    const [overtimeList, totalCount] = await Promise.all([
      prisma.overtime.findMany({
        where: { businessId, ...(startDate && endDate ? { date: attendanceDateFilter.date } : {}) },
        select: { id: true, date: true, overtimeHours: true, employee: { select: { name: true, basicSalary: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.overtime.count({ where: { businessId, ...(startDate && endDate ? { date: attendanceDateFilter.date } : {}) } })
    ]);
    response.lists.overtime = overtimeList.map(o => ({
      ...o,
      rate: o.employee?.basicSalary ? o.employee.basicSalary / 160 : 0, // Mock rate estimation
      amount: o.employee?.basicSalary ? (o.employee.basicSalary / 160) * o.overtimeHours : 0,
      status: 'Approved'
    }));
    response.lists.overtimeTotalCount = totalCount;
  }

  // TAB: loans-advances
  if (tab === 'loans-advances') {
    const [loansList, totalCount] = await Promise.all([
      prisma.loan.findMany({
        where: { businessId, ...dateFilter },
        select: { id: true, totalAmount: true, remainingAmount: true, status: true, startDate: true, employee: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.loan.count({ where: { businessId, ...dateFilter } })
    ]);
    response.lists.loansAdvances = loansList;
    response.lists.loansAdvancesTotalCount = totalCount;
  }

  // TAB: bank-requests
  if (tab === 'bank-requests') {
    const [bankRequestsList, totalCount] = await Promise.all([
      prisma.bankChangeRequest.findMany({
        where: { businessId, ...dateFilter },
        select: { id: true, bankName: true, status: true, createdAt: true, employee: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take, skip
      }),
      prisma.bankChangeRequest.count({ where: { businessId, ...dateFilter } })
    ]);
    response.lists.bankRequests = bankRequestsList;
    response.lists.bankRequestsTotalCount = totalCount;
  }

  // TAB: documents
  if (tab === 'documents') {
    response.lists.documents = [];
    response.lists.documentsTotalCount = 0;
  }

  // TAB: employee-documents
  if (tab === 'employee-documents') {
    response.lists.employeeDocuments = [];
    response.lists.employeeDocumentsTotalCount = 0;
  }

  return response;
};

module.exports = {
  getTradingHRReport
};
