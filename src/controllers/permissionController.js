const prisma = require("../config/prisma");
const { successResponse, errorResponse } = require("../utils/response");

//////////////////////////////////////////////////////
// ASSIGN PERMISSIONS
//////////////////////////////////////////////////////
exports.assignCrudPermissionsToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { module, actions } = req.body;
    const businessId = req.business.id;

    if (!module || !Array.isArray(actions)) {
      return errorResponse(res, "module & actions required", 400);
    }

    const membership = await prisma.businessUser.findFirst({
      where: {
        businessId,
        OR: [{ userId }, { id: userId }],
      },
    });

    if (!membership)
      return errorResponse(res, "User not in business", 404);

    let permissions = await prisma.permission.findMany({
      where: {
        module: { name: module },
        action: { in: actions },
      },
    });

    // Auto-create missing permissions (and module if needed)
    if (permissions.length < actions.length) {
      let mod = await prisma.module.findUnique({ where: { name: module } });
      if (!mod) {
        mod = await prisma.module.create({ data: { name: module } });
      }
      
      for (const action of actions) {
        const exists = permissions.find(p => p.action === action);
        if (!exists) {
          const newPerm = await prisma.permission.create({
            data: {
              moduleId: mod.id,
              action: action,
            }
          });
          permissions.push(newPerm);
        }
      }
    }

    const data = permissions.map((p) => ({
      businessUserId: membership.id,
      permissionId: p.id,
    }));

    await prisma.userPermission.createMany({
      data,
      skipDuplicates: true,
    });

    return successResponse(res, permissions, "Permissions assigned");
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// REMOVE PERMISSIONS
//////////////////////////////////////////////////////
exports.removeCrudPermissionsFromUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { module, actions } = req.body;
    const businessId = req.business.id;

    const membership = await prisma.businessUser.findFirst({
      where: {
        businessId,
        OR: [{ userId }, { id: userId }],
      },
    });

    if (!membership)
      return errorResponse(res, "User not found", 404);

    const permissions = await prisma.permission.findMany({
      where: {
        module: { name: module },
        action: { in: actions },
      },
    });

    await prisma.userPermission.deleteMany({
      where: {
        businessUserId: membership.id,
        permissionId: { in: permissions.map((p) => p.id) },
      },
    });

    return successResponse(res, null, "Permissions removed");
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// GET USER PERMISSIONS
//////////////////////////////////////////////////////
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const businessId = req.business.id;

    const membership = await prisma.businessUser.findFirst({
      where: {
        businessId,
        OR: [{ userId }, { id: userId }],
      },
      include: {
        userPermissions: {
          include: {
            permission: {
              include: { module: true },
            },
          },
        },
      },
    });

    if (!membership)
      return errorResponse(res, "User not found", 404);

    const result = membership.userPermissions.map((up) => ({
      module: up.permission.module.name,
      action: up.permission.action,
    }));

    return successResponse(res, result, "User permissions fetched");
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// SYNC USER PERMISSIONS (BULK ATOMIC UPDATE)
//////////////////////////////////////////////////////
exports.syncUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions: permissionsInput } = req.body;
    const businessId = req.business.id;

    if (!Array.isArray(permissionsInput)) {
      return errorResponse(res, "permissions array required", 400);
    }

    const membership = await prisma.businessUser.findFirst({
      where: {
        businessId,
        OR: [{ userId }, { id: userId }],
      },
    });

    if (!membership) {
      return errorResponse(res, "User not found in business", 404);
    }

    // permissionsInput can be [ { module: "lead", actions: ["read", "create"] } ]
    // or flat: [ { module: "lead", action: "read" } ]
    const flatPairs = [];
    for (const item of permissionsInput) {
      const modName = (item.module || "").trim().toLowerCase();
      if (!modName) continue;

      if (Array.isArray(item.actions)) {
        for (const act of item.actions) {
          const actName = String(act || "").trim().toLowerCase();
          if (actName) flatPairs.push({ module: modName, action: actName });
        }
      } else if (item.action) {
        const actName = String(item.action || "").trim().toLowerCase();
        if (actName) flatPairs.push({ module: modName, action: actName });
      }
    }

    // Deduplicate
    const uniquePairsMap = new Map();
    for (const pair of flatPairs) {
      const key = `${pair.module}:${pair.action}`;
      if (!uniquePairsMap.has(key)) {
        uniquePairsMap.set(key, pair);
      }
    }
    const uniquePairs = Array.from(uniquePairsMap.values());

    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing user permissions for this business user
      await tx.userPermission.deleteMany({
        where: { businessUserId: membership.id },
      });

      if (uniquePairs.length === 0) {
        return;
      }

      // 2. Ensure all needed modules exist
      const uniqueModuleNames = Array.from(new Set(uniquePairs.map((p) => p.module)));
      const existingModules = await tx.module.findMany();
      const moduleMap = new Map();
      for (const m of existingModules) {
        moduleMap.set(m.name.toLowerCase(), m);
      }

      for (const modName of uniqueModuleNames) {
        if (!moduleMap.has(modName)) {
          const newMod = await tx.module.create({
            data: { name: modName },
          });
          moduleMap.set(modName, newMod);
        }
      }

      // 3. Ensure permissions exist and collect IDs
      const permissionIds = [];
      for (const pair of uniquePairs) {
        const mod = moduleMap.get(pair.module);
        if (!mod) continue;

        let perm = await tx.permission.findFirst({
          where: {
            moduleId: mod.id,
            action: pair.action,
          },
        });

        if (!perm) {
          perm = await tx.permission.create({
            data: {
              moduleId: mod.id,
              action: pair.action,
            },
          });
        }
        permissionIds.push(perm.id);
      }

      // 4. Batch insert user permissions
      if (permissionIds.length > 0) {
        const data = permissionIds.map((permId) => ({
          businessUserId: membership.id,
          permissionId: permId,
        }));

        await tx.userPermission.createMany({
          data,
          skipDuplicates: true,
        });
      }
    });

    return successResponse(res, uniquePairs, "Permissions saved successfully");
  } catch (err) {
    console.error("syncUserPermissions error:", err);
    return errorResponse(res, "Internal server error", 500);
  }
};