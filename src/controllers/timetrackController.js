const prisma = require("../config/prisma");
const { validateTimeEntry } = require("../utils/validateTimeEntry");

/**
 * Safely resolves employeeId and businessUserId from provided identifiers or current user
 */
async function resolveEmployeeAndBusinessUser(prismaClient, businessId, { employeeId, businessUserId, userId } = {}) {
  let resolvedEmployeeId = null;
  let resolvedBusinessUserId = null;

  // 1. Resolve employeeId
  if (employeeId) {
    const directEmp = await prismaClient.employee.findFirst({
      where: { id: employeeId, businessId }
    });
    if (directEmp) {
      resolvedEmployeeId = directEmp.id;
    } else {
      const empByUser = await prismaClient.employee.findFirst({
        where: { userId: employeeId, businessId }
      });
      if (empByUser) resolvedEmployeeId = empByUser.id;
    }
  }

  // 2. Resolve businessUserId
  const buCandidate = businessUserId || employeeId;
  if (buCandidate) {
    const directBu = await prismaClient.businessUser.findFirst({
      where: { id: buCandidate, businessId }
    });
    if (directBu) {
      resolvedBusinessUserId = directBu.id;
    } else {
      const buByUser = await prismaClient.businessUser.findFirst({
        where: { userId: buCandidate, businessId }
      });
      if (buByUser) resolvedBusinessUserId = buByUser.id;
    }
  }

  // 3. Fallbacks using authenticated user ID if still unassigned
  if (!resolvedEmployeeId && userId) {
    const empByAuth = await prismaClient.employee.findFirst({
      where: { userId, businessId }
    });
    if (empByAuth) resolvedEmployeeId = empByAuth.id;
  }

  if (!resolvedBusinessUserId && userId) {
    const buByAuth = await prismaClient.businessUser.findFirst({
      where: { userId, businessId }
    });
    if (buByAuth) resolvedBusinessUserId = buByAuth.id;
  }

  return { resolvedEmployeeId, resolvedBusinessUserId };
}

exports.createTimeEntry = async (req, res) => {
  try {
    const { projectId, taskId, hours, overtime, billable, status, date, description, businessUserId, employeeId } = req.body;
    const targetProjectId = projectId || req.params.projectId;

    if (!targetProjectId) {
      return res.status(400).json({ success: false, message: "Project ID is required" });
    }

    await validateTimeEntry({
      projectId: targetProjectId,
      taskId: taskId || null,
      businessId: req.business.id,
    });

    const { resolvedEmployeeId, resolvedBusinessUserId } = await resolveEmployeeAndBusinessUser(
      prisma,
      req.business.id,
      { employeeId, businessUserId, userId: req.user?.id }
    );

    let parsedDate = new Date();
    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) parsedDate = d;
    }

    const entry = await prisma.timeEntry.create({
      data: {
        projectId: targetProjectId,
        taskId: taskId || null,
        hours: Number(hours) || 0,
        overtime: overtime ? Number(overtime) : 0,
        billable: billable !== undefined ? Boolean(billable) : true,
        status: status || 'DRAFT',
        date: parsedDate,
        description: description || null,
        businessId: req.business.id,
        businessUserId: resolvedBusinessUserId,
        employeeId: resolvedEmployeeId,
      },
    });

    res.json({ success: true, entry });

  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};


//////////////////////////////////////////////////////
// GET TIME ENTRIES
//////////////////////////////////////////////////////
exports.getTimeEntries = async (req, res) => {
  try {
    const entries = await prisma.timeEntry.findMany({
      where: { businessId: req.business.id },
      include: {
        project: { include: { projectManager: true } },
        task: true,
        employee: true,
        businessUser: { include: { user: true } }
      },
      orderBy: { date: 'desc' }
    });

    res.json({ success: true, entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

//////////////////////////////////////////////////////
// UPDATE TIME ENTRY
//////////////////////////////////////////////////////
exports.updateTimeEntry = async (req, res) => {
  try {
    const existing = await prisma.timeEntry.findFirst({
      where: { id: req.params.id, businessId: req.business.id }
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Time entry not found" });
    }

    const updateData = {};
    const { hours, overtime, billable, status, date, description, businessUserId, employeeId, taskId, projectId } = req.body;

    if (hours !== undefined) updateData.hours = Number(hours) || 0;
    if (overtime !== undefined) updateData.overtime = Number(overtime) || 0;
    if (billable !== undefined) updateData.billable = Boolean(billable);
    if (status !== undefined) updateData.status = status;
    if (date !== undefined) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) updateData.date = d;
    }
    if (description !== undefined) updateData.description = description;
    if (taskId !== undefined) updateData.taskId = taskId || null;
    if (projectId !== undefined) updateData.projectId = projectId;

    if (employeeId !== undefined || businessUserId !== undefined) {
      const { resolvedEmployeeId, resolvedBusinessUserId } = await resolveEmployeeAndBusinessUser(
        prisma,
        req.business.id,
        {
          employeeId: employeeId !== undefined ? employeeId : existing.employeeId,
          businessUserId: businessUserId !== undefined ? businessUserId : existing.businessUserId,
          userId: req.user?.id
        }
      );
      if (employeeId !== undefined) updateData.employeeId = resolvedEmployeeId;
      if (businessUserId !== undefined) updateData.businessUserId = resolvedBusinessUserId;
    }

    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

//////////////////////////////////////////////////////
// DELETE TIME ENTRY
//////////////////////////////////////////////////////
exports.deleteTimeEntry = async (req, res) => {
  try {
    const existing = await prisma.timeEntry.findFirst({
      where: { id: req.params.id, businessId: req.business.id }
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Time entry not found" });
    }

    await prisma.timeEntry.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};