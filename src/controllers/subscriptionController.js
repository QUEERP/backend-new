const prisma = require("../config/prisma");
const SubscriptionService = require("../services/subscriptionService");
const { successResponse, errorResponse } = require("../utils/response");

//////////////////////////////////////////////////////
// GET ANY BUSINESS SUBSCRIPTION (ADMIN ONLY)
//////////////////////////////////////////////////////
exports.getSubscription = async (req, res) => {
  try {
    const { businessId } = req.query;

    if (!businessId) {
      return errorResponse(res, "businessId is required", 400);
    }

    const subscription = await SubscriptionService.getSubscription(businessId);

    return successResponse(res, subscription, "Subscription fetched");
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// ACTIVATE SUBSCRIPTION
//////////////////////////////////////////////////////
exports.activateSubscription = async (req, res) => {
  try {
    const { businessId, durationMonths, durationDays, planName, notes } = req.body;

    if (!businessId)
      return errorResponse(res, "businessId required", 400);

    const subscription = await SubscriptionService.activateSubscription(businessId, {
      durationMonths,
      durationDays,
      planName,
      notes,
    });

    return successResponse(res, subscription, "Subscription activated");

  } catch (error) {
    console.error("Activate subscription error:", error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// EXTEND SUBSCRIPTION
//////////////////////////////////////////////////////
exports.extendSubscription = async (req, res) => {
  try {
    const { businessId, durationMonths, durationDays, planName, notes } = req.body;

    if (!businessId) {
      return errorResponse(res, "businessId required", 400);
    }

    const subscription = await SubscriptionService.extendSubscription(
      businessId,
      { durationMonths, durationDays, planName, notes }
    );

    return successResponse(res, subscription, "Subscription extended");
  } catch (error) {
    console.error("Extend subscription error:", error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// DEACTIVATE
//////////////////////////////////////////////////////
exports.deactivateSubscription = async (req, res) => {
  try {
    const { businessId } = req.body;

    if (!businessId) {
      return errorResponse(res, "businessId required", 400);
    }

    const subscription =
      await SubscriptionService.deactivateSubscription(businessId);

    return successResponse(res, subscription, "Deactivated");
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// UPDATE SUBSCRIPTION PLAN
//////////////////////////////////////////////////////
exports.updatePlan = async (req, res) => {
  try {
    const { businessId, planName, notes, expiresAt, status } = req.body;

    if (!businessId) {
      return errorResponse(res, "businessId is required", 400);
    }

    const subscription = await SubscriptionService.updatePlan(businessId, {
      planName,
      notes,
      expiresAt,
      status,
    });

    return successResponse(res, subscription, "Subscription plan updated successfully");
  } catch (error) {
    console.error("Update plan error:", error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// ALL SUBSCRIPTIONS
//////////////////////////////////////////////////////
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    const subscriptions = await SubscriptionService.getAllSubscriptions({
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return successResponse(res, subscriptions, "All subscriptions");
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// STATS
//////////////////////////////////////////////////////
exports.getSubscriptionStats = async (req, res) => {
  try {
    const stats = await SubscriptionService.getSubscriptionStats();
    return successResponse(res, stats, "Stats fetched");
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// ALL BUSINESSES (ADMIN DIRECTORY)
//////////////////////////////////////////////////////
exports.getBusinesses = async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 100 } = req.query;

    const result = await SubscriptionService.getAllBusinesses({
      search,
      isActive,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return successResponse(res, result, "Businesses fetched");
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// TOGGLE BUSINESS ACTIVE STATUS
//////////////////////////////////////////////////////
exports.toggleBusinessStatus = async (req, res) => {
  try {
    const { businessId } = req.body;

    if (!businessId) {
      return errorResponse(res, "businessId is required", 400);
    }

    const business = await SubscriptionService.toggleBusinessStatus(businessId);
    return successResponse(
      res,
      business,
      `Business ${business.isActive ? "activated" : "deactivated"} successfully`
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// ALLOCATE MODULES TO BUSINESS
//////////////////////////////////////////////////////
exports.allocateModules = async (req, res) => {
  try {
    const { businessId, modules } = req.body;

    if (!businessId) {
      return errorResponse(res, "businessId is required", 400);
    }

    if (!Array.isArray(modules)) {
      return errorResponse(res, "modules must be an array of strings", 400);
    }

    const business = await SubscriptionService.allocateModules(businessId, modules);

    return successResponse(
      res,
      business,
      "Modules allocated successfully"
    );
  } catch (error) {
    console.error("Allocate modules error:", error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// ALL PLATFORM USERS (SUPER ADMIN DIRECTORY)
//////////////////////////////////////////////////////
exports.getUsers = async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 100 } = req.query;
    const data = await SubscriptionService.getAllUsers({
      search,
      isActive,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return successResponse(res, data, "Users fetched successfully");
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// TOGGLE USER STATUS
//////////////////////////////////////////////////////
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return errorResponse(res, "userId is required", 400);
    }
    const user = await SubscriptionService.toggleUserStatus(userId);
    return successResponse(
      res,
      user,
      `User ${user.isActive ? "activated" : "deactivated"} successfully`
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};

//////////////////////////////////////////////////////
// CREATE PLATFORM USER
//////////////////////////////////////////////////////
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await SubscriptionService.createUser({ name, email, password, role });
    return successResponse(res, user, "User created successfully", 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 400);
  }
};

//////////////////////////////////////////////////////
// GET ALL SYSTEM PERMISSIONS
//////////////////////////////////////////////////////
exports.getPermissions = async (req, res) => {
  try {
    const permissions = await SubscriptionService.getAllPermissions();
    return successResponse(res, permissions, "Permissions fetched successfully");
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message, 500);
  }
};


