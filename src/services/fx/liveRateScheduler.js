/**
 * 24h Scheduled Job for Live Exchange Rate Synchronization
 * 
 * Automatically syncs live commercial rates for all businesses and currencies in use.
 * Configurable via RATE_SYNC_INTERVAL_HOURS (default 24h).
 */

const prisma = require('../../config/prisma');
const { liveRateSyncService } = require('./liveRateSyncService');

class LiveRateScheduler {
  constructor() {
    this.intervalHandle = null;
    this.intervalHours = parseInt(process.env.RATE_SYNC_INTERVAL_HOURS, 10) || 24;
    this.isRunning = false;
  }

  start() {
    if (this.intervalHandle) return;

    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    console.log(`[LiveRateScheduler] Starting 24h live rate sync scheduler (interval: ${this.intervalHours}h)`);

    // Run first sync after initial 10s delay to let server boot up cleanly
    setTimeout(() => {
      this.syncAllBusinesses().catch(err => {
        console.error('[LiveRateScheduler] Initial background sync error:', err.message);
      });
    }, 10000);

    // Set recurring timer
    this.intervalHandle = setInterval(() => {
      this.syncAllBusinesses().catch(err => {
        console.error('[LiveRateScheduler] Scheduled sync error:', err.message);
      });
    }, intervalMs);

    if (this.intervalHandle.unref) {
      this.intervalHandle.unref(); // Don't block process exit if tests are running
    }
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async syncAllBusinesses() {
    if (this.isRunning) {
      console.log('[LiveRateScheduler] Sync is already running, skipping overlapping run.');
      return;
    }

    this.isRunning = true;
    console.log('[LiveRateScheduler] Commencing scheduled exchange rate sync for active businesses...');

    try {
      const businesses = await prisma.business.findMany({
        select: { id: true, name: true }
      });

      for (const biz of businesses) {
        try {
          const res = await liveRateSyncService.syncRatesForBusiness(biz.id, { forceRefresh: false });
          if (res.syncedCount > 0) {
            console.log(`[LiveRateScheduler] Business "${biz.name}" (${biz.id}): Synced ${res.syncedCount} new rates, skipped ${res.skippedCount} duplicates.`);
          }
        } catch (bizErr) {
          console.error(`[LiveRateScheduler] Failed to sync rates for business "${biz.name}" (${biz.id}):`, bizErr.message);
        }
      }
      console.log('[LiveRateScheduler] Scheduled sync completed successfully.');
    } catch (err) {
      console.error('[LiveRateScheduler] Critical failure in syncAllBusinesses:', err.message);
    } finally {
      this.isRunning = false;
    }
  }
}

const liveRateScheduler = new LiveRateScheduler();

module.exports = {
  LiveRateScheduler,
  liveRateScheduler
};
