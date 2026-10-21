const prisma = require("../config/prisma");

//////////////////////////////////////////////////////
// SUBSCRIPTION SERVICE LAYER
//////////////////////////////////////////////////////

class SubscriptionService {
  /**
   * Get subscription details for a business
   * @param {string} businessId - Business ID
   * @returns {Promise<Object>} Subscription details
   */
  static async getSubscription(businessId) {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) {
      throw new Error("Subscription not found for this business");
    }

    // Calculate remaining days
    const now = new Date();
    const expiresAt = new Date(subscription.expiresAt);
    const remainingDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    return {
      ...subscription,
      remainingDays: Math.max(0, remainingDays),
      isActive: subscription.status === "ACTIVE" && expiresAt > now,
    };
  }

  /**
   * Activate subscription for a business
   * @param {string} businessId - Business ID
   * @param {Object} options - Activation options
   * @returns {Promise<Object>} Updated subscription
   */
  static async activateSubscription(businessId, options = {}) {
    const { durationMonths, durationDays, planName, notes } = options;
    
    const now = new Date();
    let expiresAt = new Date(now);

    if (durationDays !== undefined && durationDays !== null && Number(durationDays) > 0) {
      expiresAt = new Date(now.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);
    } else if (durationMonths !== undefined && durationMonths !== null && Number(durationMonths) > 0) {
      expiresAt.setMonth(expiresAt.getMonth() + Number(durationMonths));
    } else {
      // Default to 1 month (30 days)
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const subscription = await prisma.subscription.upsert({
      where: { businessId },
      update: {
        status: "ACTIVE",
        startDate: now,
        expiresAt,
        planName: planName || "Standard",
        notes: notes || null,
      },
      create: {
        businessId,
        status: "ACTIVE",
        startDate: now,
        expiresAt,
        planName: planName || "Standard",
        notes: notes || null,
      },
    });

    // Sync business isActive status
    await prisma.business.update({
      where: { id: businessId },
      data: { isActive: true },
    });

    return subscription;
  }

  /**
   * Extend subscription for a business
   * @param {string} businessId - Business ID
   * @param {Object} options - Extension options
   * @returns {Promise<Object>} Updated subscription
   */
  static async extendSubscription(businessId, options = {}) {
    const { durationMonths, durationDays, planName, notes } = options;
    
    const currentSubscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!currentSubscription) {
      throw new Error("Subscription not found for this business");
    }

    const now = new Date();
    let baseDate;

    // If subscription is active and not expired, extend from current expiry
    // If expired, inactive, or has no expiry, extend starting from current date
    if (
      currentSubscription.status === "ACTIVE" &&
      currentSubscription.expiresAt &&
      new Date(currentSubscription.expiresAt) > now
    ) {
      baseDate = new Date(currentSubscription.expiresAt);
    } else {
      baseDate = now;
    }

    let newExpiresAt = new Date(baseDate);
    if (durationDays !== undefined && durationDays !== null && Number(durationDays) > 0) {
      newExpiresAt = new Date(baseDate.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);
    } else if (durationMonths !== undefined && durationMonths !== null && Number(durationMonths) > 0) {
      newExpiresAt.setMonth(newExpiresAt.getMonth() + Number(durationMonths));
    } else {
      newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { businessId },
      data: {
        status: "ACTIVE",
        startDate: currentSubscription.startDate || now,
        expiresAt: newExpiresAt,
        planName: planName || currentSubscription.planName || "Standard",
        notes: notes !== undefined ? notes : currentSubscription.notes,
      },
    });

    // Ensure business is active
    await prisma.business.update({
      where: { id: businessId },
      data: { isActive: true },
    });

    return updatedSubscription;
  }

  /**
   * Deactivate subscription for a business
   * @param {string} businessId - Business ID
   * @returns {Promise<Object>} Updated subscription
   */
  static async deactivateSubscription(businessId) {
    const subscription = await prisma.subscription.update({
      where: { businessId },
      data: {
        status: "INACTIVE",
      },
    });

    // Deactivate business
    await prisma.business.update({
      where: { id: businessId },
      data: { isActive: false },
    });

    return subscription;
  }

  /**
   * Update subscription plan and details for a business
   * @param {string} businessId - Business ID
   * @param {Object} options - Plan update options
   * @returns {Promise<Object>} Updated subscription
   */
  static async updatePlan(businessId, options = {}) {
    const { planName, notes, expiresAt, status } = options;

    const currentSubscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!currentSubscription) {
      throw new Error("Subscription not found for this business");
    }

    const updateData = {};
    if (planName) updateData.planName = planName;
    if (notes !== undefined) updateData.notes = notes;
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    if (status) {
      updateData.status = status;
      if (status === "ACTIVE") {
        await prisma.business.update({
          where: { id: businessId },
          data: { isActive: true },
        });
      }
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { businessId },
      data: updateData,
    });

    return updatedSubscription;
  }

  /**
   * Check if business has active subscription
   * @param {string} businessId - Business ID
   * @returns {Promise<boolean>} True if subscription is active
   */
  static async isSubscriptionActive(businessId) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
      });

      if (!subscription) {
        return false;
      }

      const now = new Date();
      const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
      
      return subscription.status === "ACTIVE" && Boolean(expiresAt && expiresAt > now);
    } catch (error) {
      console.error("Error checking subscription:", error);
      return false;
    }
  }

  /**
   * Get all subscriptions (admin only)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of subscriptions
   */
  static async getAllSubscriptions(filters = {}) {
    const { status, page = 1, limit = 100 } = filters;
    
    const where = status ? { status } : {};
    
    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            name: true,
            legalName: true,
            countryCode: true,
            currencyCode: true,
            isActive: true,
            createdAt: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                users: true,
                invoices: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Add computed fields
    const now = new Date();
    return subscriptions.map(sub => {
      const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
      const remainingDays = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;
      const isTermActive = sub.status === "ACTIVE" && Boolean(expiresAt && expiresAt > now);
      return {
        ...sub,
        remainingDays: remainingDays !== null ? Math.max(0, remainingDays) : null,
        isActive: isTermActive,
      };
    });
  }

  /**
   * Get subscription statistics for super admin dashboard
   * @returns {Promise<Object>} Statistics summary
   */
  static async getSubscriptionStats() {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalBusinesses,
      activeBusinesses,
      totalSubscriptions,
      allSubscriptions,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { isActive: true } }),
      prisma.subscription.count(),
      prisma.subscription.findMany({
        select: {
          id: true,
          status: true,
          expiresAt: true,
          planName: true,
        },
      }),
    ]);

    let activeCount = 0;
    let expiredCount = 0;
    let inactiveCount = 0;
    let expiringSoonCount = 0;
    const planBreakdown = {};

    for (const sub of allSubscriptions) {
      const plan = sub.planName || "Default";
      planBreakdown[plan] = (planBreakdown[plan] || 0) + 1;

      const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
      const isDateValid = Boolean(expiresAt && expiresAt > now);

      if (sub.status === "ACTIVE" && isDateValid) {
        activeCount++;
        if (expiresAt && expiresAt <= in7Days) {
          expiringSoonCount++;
        }
      } else if (sub.status === "EXPIRED" || (sub.status === "ACTIVE" && expiresAt && expiresAt <= now)) {
        expiredCount++;
      } else {
        inactiveCount++;
      }
    }

    return {
      totalBusinesses,
      activeBusinesses,
      totalSubscriptions,
      activeSubscriptions: activeCount,
      expiredSubscriptions: expiredCount,
      inactiveSubscriptions: inactiveCount,
      expiringSoon: expiringSoonCount,
      statusBreakdown: {
        ACTIVE: activeCount,
        EXPIRED: expiredCount,
        INACTIVE: inactiveCount,
      },
      planBreakdown,
    };
  }

  /**
   * Get all registered businesses with tenant & subscription info
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Businesses list with pagination
   */
  static async getAllBusinesses(filters = {}) {
    const { search, isActive, page = 1, limit = 100 } = filters;
    const where = {};

    if (isActive !== undefined && isActive !== null && isActive !== "") {
      where.isActive = isActive === true || isActive === "true";
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { legalName: { contains: term, mode: "insensitive" } },
        { owner: { email: { contains: term, mode: "insensitive" } } },
        { owner: { name: { contains: term, mode: "insensitive" } } },
      ];
    }

    const [total, businesses] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        include: {
          subscription: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              users: true,
              invoices: true,
              bills: true,
              customers: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const now = new Date();
    const formatted = businesses.map((biz) => {
      let subInfo = null;
      if (biz.subscription) {
        const expiresAt = biz.subscription.expiresAt ? new Date(biz.subscription.expiresAt) : null;
        const remainingDays = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;
        subInfo = {
          ...biz.subscription,
          remainingDays: remainingDays !== null ? Math.max(0, remainingDays) : null,
          isActuallyActive: biz.subscription.status === "ACTIVE" && Boolean(expiresAt && expiresAt > now),
        };
      }
      return {
        ...biz,
        subscription: subInfo,
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      businesses: formatted,
    };
  }

  /**
   * Toggle business active status
   * @param {string} businessId - Business ID
   * @returns {Promise<Object>} Updated business
   */
  static async toggleBusinessStatus(businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new Error("Business not found");
    }

    const nextState = !business.isActive;
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { isActive: nextState },
    });

    return updated;
  }

  /**
   * Allocate ERP functional modules to a business
   * @param {string} businessId - Business ID
   * @param {string[]} modules - Array of module keys
   * @returns {Promise<Object>} Updated business
   */
  static async allocateModules(businessId, modules) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new Error("Business not found");
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        allocatedModules: Array.isArray(modules) ? modules : [],
      },
    });

    return updated;
  }

  /**
   * Get all platform users across all tenants
   * @param {Object} filters
   * @returns {Promise<Object>}
   */
  static async getAllUsers(filters = {}) {
    const { search, isActive, page = 1, limit = 100 } = filters;
    const where = {};

    if (isActive !== undefined && isActive !== null && isActive !== "") {
      where.isActive = isActive === true || isActive === "true";
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          memberships: {
            include: {
              business: { select: { id: true, name: true } },
              role: { select: { id: true, name: true } },
            },
          },
          businessesOwned: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users,
    };
  }

  /**
   * Toggle user active status
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async toggleUserStatus(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error("User not found");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return updated;
  }

  /**
   * Create a platform user
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async createUser(data) {
    const bcrypt = require("bcryptjs");
    const { name, email, password, role = "USER" } = data;

    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error("User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Get all system permissions grouped by module
   * @returns {Promise<Array>}
   */
  static async getAllPermissions() {
    const permissions = await prisma.permission.findMany({
      include: {
        module: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ moduleId: "asc" }, { action: "asc" }],
    });

    // Group by module
    const grouped = {};
    for (const p of permissions) {
      const modName = p.module?.name || "General";
      if (!grouped[modName]) {
        grouped[modName] = {
          moduleId: p.moduleId,
          moduleName: modName,
          permissions: [],
        };
      }
      grouped[modName].permissions.push({
        id: p.id,
        action: p.action,
      });
    }

    return Object.values(grouped);
  }
}

module.exports = SubscriptionService;
