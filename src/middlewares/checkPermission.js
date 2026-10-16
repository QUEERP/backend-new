const prisma = require("../config/prisma");
const { errorResponse } = require("../utils/response");

const checkPermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId || req.user.id;
      const businessId = req.business.id;

      ////////////////////////////////////////////////////
      // 1️⃣ BUSINESS OWNER BYPASS (FULL ACCESS)
      ////////////////////////////////////////////////////
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });

      if (business && business.ownerId === userId) {
        return next(); // ✅ OWNER CAN DO EVERYTHING
      }

      ////////////////////////////////////////////////////
      // 2️⃣ CHECK MEMBERSHIP & ADMIN BYPASS
      ////////////////////////////////////////////////////
      const membership = await prisma.businessUser.findFirst({
        where: {
          userId,
          businessId,
          isActive: true,
        },
        include: { role: true },
      });

      if (!membership) {
        return errorResponse(res, "Access denied: Not an active member of this business", 403);
      }

      if (
        membership.role &&
        (membership.role.name === "Admin" ||
          membership.role.name === "SUPER_ADMIN" ||
          membership.role.name === "Owner")
      ) {
        return next(); // ✅ ADMIN CAN DO EVERYTHING
      }

      ////////////////////////////////////////////////////
      // 3️⃣ NORMAL USER PERMISSION CHECK
      ////////////////////////////////////////////////////
      const normalizedMod = String(moduleName || "").trim().toLowerCase();
      const singularMod = normalizedMod.endsWith("s")
        ? normalizedMod.slice(0, -1)
        : normalizedMod;
      const pluralMod = normalizedMod.endsWith("s")
        ? normalizedMod
        : `${normalizedMod}s`;
      const actionLower = String(action || "").trim().toLowerCase();

      const actionCandidates = [actionLower];
      if (actionLower === "view") actionCandidates.push("read");
      if (actionLower === "read") actionCandidates.push("view");
      if (actionLower === "edit") actionCandidates.push("update");
      if (actionLower === "update") actionCandidates.push("edit");

      const modCandidates = Array.from(
        new Set([normalizedMod, singularMod, pluralMod])
      );

      const permission = await prisma.userPermission.findFirst({
        where: {
          businessUserId: membership.id,
          permission: {
            action: { in: actionCandidates, mode: "insensitive" },
            module: {
              name: { in: modCandidates, mode: "insensitive" },
            },
          },
        },
      });

      if (!permission) {
        return errorResponse(
          res,
          `Permission denied (${moduleName}:${action})`,
          403
        );
      }

      next();
    } catch (err) {
      console.error("Permission Error:", err);
      return errorResponse(res, "Internal server error", 500);
    }
  };
};

module.exports = checkPermission;