const prisma = require("../config/prisma");

/**
 * Synchronizes 90-Day Free Trial status for a user and all their owned businesses.
 * 
 * Rules:
 * 1. Countdown begins immediately upon user registration.
 * 2. User has a single trial start date and expiry date.
 * 3. All businesses created under that user inherit and share the exact same trial expiry date.
 * 4. Creating new businesses does not restart or extend the trial period.
 * 5. When the user's 90-day trial expires, all businesses owned by that user automatically become inactive.
 */
async function syncUserTrialStatus(userId) {
  if (!userId || userId === "subscription-admin") return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        isTrial: true,
        trialStartsAt: true,
        trialExpiresAt: true,
      },
    });

    if (!user || !user.isTrial) {
      return null;
    }

    const trialStart = user.trialStartsAt || user.createdAt;
    const trialExpiry = user.trialExpiresAt || new Date(trialStart.getTime() + 90 * 24 * 60 * 60 * 1000);

    // If user record is missing timestamps, persist them
    if (!user.trialStartsAt || !user.trialExpiresAt) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          trialStartsAt: trialStart,
          trialExpiresAt: trialExpiry,
        },
      });
    }

    const now = new Date();
    const isExpired = now > trialExpiry;

    // Find all businesses owned by this user
    const ownedBusinesses = await prisma.business.findMany({
      where: { ownerId: userId },
      select: { id: true, isActive: true },
    });

    const businessIds = ownedBusinesses.map((b) => b.id);

    if (businessIds.length > 0) {
      if (isExpired) {
        // Deactivate all businesses owned by this user
        await prisma.business.updateMany({
          where: {
            id: { in: businessIds },
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        // Set subscriptions to EXPIRED
        await prisma.subscription.updateMany({
          where: {
            businessId: { in: businessIds },
            status: "ACTIVE",
          },
          data: {
            status: "EXPIRED",
            expiresAt: trialExpiry,
          },
        });
      } else {
        // Active trial: sync all trial subscriptions to match the user's trial start & expiry
        await prisma.subscription.updateMany({
          where: {
            businessId: { in: businessIds },
            planName: "90-Day Free Trial",
          },
          data: {
            startDate: trialStart,
            expiresAt: trialExpiry,
            status: "ACTIVE",
          },
        });
      }
    }

    return {
      isTrial: true,
      trialStartsAt: trialStart,
      trialExpiresAt: trialExpiry,
      isExpired,
      remainingDays: Math.max(0, Math.ceil((trialExpiry - now) / (1000 * 60 * 60 * 24))),
    };
  } catch (error) {
    console.error(`[trialSyncService] Error syncing trial for user ${userId}:`, error.message);
    return null;
  }
}

module.exports = {
  syncUserTrialStatus,
};

