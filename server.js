require("dotenv").config();

const app = require("./src/app");
const { liveRateScheduler } = require("./src/services/fx/liveRateScheduler");

const PORT = process.env.PORT || 3001;

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  liveRateScheduler.start(); // Active

  // Periodic subscription deadline check (runs every 12 hours)
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const SubscriptionService = require("./src/services/subscriptionService");
      console.log("[SCHEDULER] Checking expiring subscriptions for deadline notifications...");
      const res = await SubscriptionService.checkAndNotifyExpiringSubscriptions();
      console.log(`[SCHEDULER] Subscription check complete. Notified: ${res.sentCount}/${res.totalEvaluated}`);
    } catch (err) {
      console.error("[SCHEDULER ERROR] Failed to check expiring subscriptions:", err.message);
    }
  }, TWELVE_HOURS);
});

// Fixed: Correctly binding keepAliveTimeout to the server instance
server.keepAliveTimeout = 65000; // must exceed OLS's 60s pcKeepAliveTimeout
server.headersTimeout = 66000;   // must exceed keepAliveTimeout