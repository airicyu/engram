/** In-process Bun.cron jobs for dream maintenance (0.21). */

import { config } from "../config";
import { logError, logInfo } from "../log";
import { sweepDreamArtifacts } from "../store/dreams/cleanup";
import { tryScheduledAutoDream } from "./auto-dream";

/** Register cleanup and optional auto-dream crons. OS-level cron is intentionally not used. */
export function registerEngramCronJobs(): void {
  if (config.dreamCleanupCronEnabled) {
    Bun.cron(
      config.dreamCleanupCron,
      async () => {
        try {
          await sweepDreamArtifacts();
        } catch (e) {
          logError("scheduled dream cleanup failed", e);
        }
      },
      { tz: config.timezone },
    );
    logInfo("dream cleanup cron registered", {
      schedule: config.dreamCleanupCron,
      timezone: config.timezone,
    });
  }

  if (config.autoDreamEnabled) {
    Bun.cron(
      config.autoDreamCron,
      async () => {
        try {
          await tryScheduledAutoDream();
        } catch (e) {
          logError("scheduled auto dream failed", e);
        }
      },
      { tz: config.timezone },
    );
    logInfo("auto dream cron registered", {
      schedule: config.autoDreamCron,
      timezone: config.timezone,
    });
  }
}
