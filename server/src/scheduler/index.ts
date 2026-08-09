/** In-process Bun.cron jobs for dream maintenance and attachment housekeep (0.21, 0.29). */

import { config } from "../config";
import { logError, logInfo } from "../log";
import { sweepDreamArtifacts } from "../store/dreams/cleanup";
import { housekeepTmpUploads } from "../store/memories/attachments";
import { tryScheduledAutoDream } from "./auto-dream";

/** Register cleanup, attachment housekeep, and optional auto-dream crons. */
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

  if (config.attachmentHousekeepCronEnabled) {
    Bun.cron(
      config.attachmentHousekeepCron,
      async () => {
        try {
          await housekeepTmpUploads();
        } catch (e) {
          logError("scheduled attachment housekeep failed", e);
        }
      },
      { tz: config.timezone },
    );
    logInfo("attachment housekeep cron registered", {
      schedule: config.attachmentHousekeepCron,
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
