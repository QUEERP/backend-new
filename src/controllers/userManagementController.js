const prisma = require("../config/prisma");
const { successResponse, errorResponse } = require("../utils/response");
//////////////////////////////////////////////////////
// GET BUSINESS USERS (NO ADMIN)
//////////////////////////////////////////////////////
const getBusinessUsers = async (req, res) => {
  try {
    const businessId = req.business.id;

    const excludeAdmins = req.query.excludeAdmins === "true";
    const whereClause = { businessId };
    
    if (excludeAdmins) {
      whereClause.role = {
        name: { notIn: ["ADMIN", "SUPER_ADMIN"] }
      };
    }

    const users = await prisma.businessUser.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        role: true,
        userPermissions: {   // ✅ FIXED
          include: { permission: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(
      res,
      users,
      "Users fetched successfully"
    );
  } catch (error) {
    console.error("getBusinessUsers error:", error);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// CREATE NEW USER & ADD TO BUSINESS
//////////////////////////////////////////////////////
const bcrypt = require("bcryptjs");

const createUser = async (req, res) => {
  try {
    const { name, email, password, roleName } = req.body;
    const businessId = req.business.id;

    if (!name || !email || !password) {
      return errorResponse(res, "Name, email, and password are required", 400);
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const existingMembership = await prisma.businessUser.findUnique({
        where: {
          userId_businessId: { userId: user.id, businessId },
        },
      });

      if (existingMembership) {
        return errorResponse(res, "User already exists in business", 400);
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });
    }

    const roleToFind = roleName || "User";
    let role = await prisma.role.findFirst({
      where: { businessId, name: roleToFind },
    });

    if (!role) {
      const allowedRoles = ["Admin", "Manager", "Accountant", "User", "Viewer"];
      if (allowedRoles.includes(roleToFind)) {
        role = await prisma.role.create({
          data: { name: roleToFind, businessId },
        });
      } else {
        return errorResponse(res, `Role '${roleToFind}' not found.`, 400);
      }
    }

    const membership = await prisma.businessUser.create({
      data: {
        userId: user.id,
        businessId,
        roleId: role.id,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: true,
      },
    });

    return successResponse(res, membership, "User created and added successfully");
  } catch (error) {
    console.error("createUser error:", error);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// INVITE USER TO BUSINESS
//////////////////////////////////////////////////////
const inviteUser = async (req, res) => {
  try {
    const { email } = req.body;
    const businessId = req.business.id;

    //////////////////////////////////////////////////////
    // 1️⃣ CHECK USER EXISTS
    //////////////////////////////////////////////////////
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return errorResponse(
        res,
        "User not found. Ask user to signup first.",
        404
      );
    }

    //////////////////////////////////////////////////////
    // 2️⃣ CHECK ALREADY MEMBER
    //////////////////////////////////////////////////////
    const existing = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: user.id,
          businessId,
        },
      },
    });

    if (existing) {
      return errorResponse(res, "User already exists in business", 400);
    }

    //////////////////////////////////////////////////////
    // 3️⃣ FIND DEFAULT ROLE (AUTO)
    //////////////////////////////////////////////////////
    let defaultRole = await prisma.role.findFirst({
      where: {
        businessId,
        name: "User",   // ⭐ default role name
      },
    });

    if (!defaultRole) {
      defaultRole = await prisma.role.create({
        data: { name: "User", businessId },
      });
    }

    //////////////////////////////////////////////////////
    // 4️⃣ CREATE MEMBERSHIP
    //////////////////////////////////////////////////////
    const membership = await prisma.businessUser.create({
      data: {
        userId: user.id,
        businessId,
        roleId: defaultRole.id,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: true,
      },
    });

    return successResponse(res, membership, "User invited successfully");

  } catch (error) {
    console.error("inviteUser error:", error);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// TOGGLE USER STATUS
//////////////////////////////////////////////////////
const toggleUserStatus = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const businessId = req.business.id;

    const membership = await prisma.businessUser.findFirst({
      where: {
        id: membershipId,
        businessId,
      },
    });

    if (!membership) {
      return errorResponse(res, "Membership not found", 404);
    }

    const updated = await prisma.businessUser.update({
      where: { id: membershipId },
      data: {
        isActive: !membership.isActive,
      },
    });

    return successResponse(
      res,
      updated,
      "User status updated"
    );
  } catch (error) {
    console.error("toggleUserStatus error:", error);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// ASSIGN DIRECT PERMISSION
//////////////////////////////////////////////////////
const assignDirectPermission = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { permissionId } = req.body;

    const exists = await prisma.userPermission.findUnique({
      where: {
        businessUserId_permissionId: {
          businessUserId: membershipId,
          permissionId,
        },
      },
    });

    if (exists) {
      return errorResponse(res, "Permission already assigned", 400);
    }

    const permission = await prisma.userPermission.create({
      data: {
        businessUserId: membershipId,
        permissionId,
      },
      include: {
        permission: true,
      },
    });

    return successResponse(
      res,
      permission,
      "Permission assigned"
    );
  } catch (error) {
    console.error("assignDirectPermission error:", error);
    return errorResponse(res, "Internal server error", 500);
  }
};

//////////////////////////////////////////////////////
// CANCEL INVITE (SAFE VERSION)
//////////////////////////////////////////////////////
const cancelInvite = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const businessId = req.business.id;

    // 1️⃣ check membership exists
    const membership = await prisma.businessUser.findFirst({
      where: {
        id: membershipId,
        businessId,
      },
      include: { role: true },
    });

    if (!membership) {
      return errorResponse(res, "Invite not found", 404);
    }

    // 2️⃣ prevent deleting admin
    if (membership.role.name === "Admin") {
      return errorResponse(
        res,
        "Cannot cancel admin membership",
        400
      );
    }

    // 3️⃣ SAFE DELETE (no crash)
    await prisma.businessUser.delete({
      where: { id: membershipId },
    });

    return successResponse(res, null, "Invite cancelled successfully");

  } catch (error) {
    console.error("cancelInvite error:", error);

    return errorResponse(
      res,
      error.message || "Internal server error",
      500
    );
  }
};

//////////////////////////////////////////////////////
// UPDATE USER DETAILS (NAME, EMAIL, ROLE, STATUS, PASSWORD)
//////////////////////////////////////////////////////
const updateUser = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const businessId = req.business.id;
    const { name, email, roleName, status, isActive, password } = req.body;

    const membership = await prisma.businessUser.findFirst({
      where: {
        businessId,
        OR: [
          { id: membershipId },
          { userId: membershipId },
        ],
      },
      include: {
        user: true,
        role: true,
      },
    });

    if (!membership) {
      return errorResponse(res, "User membership not found", 404);
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    const isOwner = business && business.ownerId === membership.userId;

    // Check if trying to deactivate business owner
    const targetIsActive = typeof isActive === "boolean" 
      ? isActive 
      : (typeof status === "string" ? status.toLowerCase() === "active" : undefined);

    if (isOwner && targetIsActive === false) {
      return errorResponse(res, "Cannot deactivate the business owner", 400);
    }

    // 1. Update user credentials / info in prisma.user
    const userUpdateData = {};
    if (name && name.trim()) {
      userUpdateData.name = name.trim();
    }
    if (email && email.trim() && email.trim().toLowerCase() !== membership.user.email.toLowerCase()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser && existingUser.id !== membership.userId) {
        return errorResponse(res, "Email already in use by another account", 400);
      }
      userUpdateData.email = normalizedEmail;
    }
    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return errorResponse(res, "Password must be at least 6 characters long", 400);
      }
      userUpdateData.password = await bcrypt.hash(password.trim(), 10);
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: membership.userId },
        data: userUpdateData,
      });
    }

    // 2. Update membership (role, isActive)
    const membershipUpdateData = {};
    if (typeof targetIsActive === "boolean") {
      membershipUpdateData.isActive = targetIsActive;
    }

    if (roleName && roleName.trim() && roleName.trim() !== membership.role?.name) {
      if (isOwner && roleName.trim() !== "Admin") {
        return errorResponse(res, "Business owner role must remain Admin", 400);
      }

      const roleToFind = roleName.trim();
      let role = await prisma.role.findFirst({
        where: { businessId, name: roleToFind },
      });

      if (!role) {
        const allowedRoles = ["Admin", "Manager", "Accountant", "User", "Viewer"];
        if (allowedRoles.includes(roleToFind)) {
          role = await prisma.role.create({
            data: { name: roleToFind, businessId },
          });
        } else {
          return errorResponse(res, `Role '${roleToFind}' not found.`, 400);
        }
      }
      membershipUpdateData.roleId = role.id;
    }

    if (Object.keys(membershipUpdateData).length > 0) {
      await prisma.businessUser.update({
        where: { id: membership.id },
        data: membershipUpdateData,
      });
    }

    // Fetch updated membership
    const updated = await prisma.businessUser.findUnique({
      where: { id: membership.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        role: true,
      },
    });

    return successResponse(res, updated, "User updated successfully");
  } catch (error) {
    console.error("updateUser error:", error);
    return errorResponse(res, "Internal server error", 500);
  }
};

module.exports = {
  getBusinessUsers,
  createUser,
  inviteUser,
  toggleUserStatus,
  assignDirectPermission,
  cancelInvite,
  updateUser,
};
