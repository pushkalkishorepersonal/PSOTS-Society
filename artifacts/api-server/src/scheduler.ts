import { db, listingsTable, noticesTable } from "@workspace/db";
import { and, eq, isNull, lt, isNotNull } from "drizzle-orm";
import { logger } from "./lib/logger";

const LISTING_EXPIRY_DAYS = 30;
const NOTICE_ARCHIVE_DAYS = 60;

async function runArchivingJob() {
  const now = new Date();

  // 1. Expire marketplace listings that have passed their expiresAt date
  const expiredListings = await db
    .update(listingsTable)
    .set({ isActive: false, status: "expired" })
    .where(
      and(
        eq(listingsTable.status, "active"),
        lt(listingsTable.expiresAt, now)
      )
    )
    .returning({ id: listingsTable.id });

  if (expiredListings.length > 0) {
    logger.info({ count: expiredListings.length }, "Listings auto-expired");
  }

  // 2. Archive old (non-pinned) notices older than NOTICE_ARCHIVE_DAYS
  const archiveBefore = new Date(now.getTime() - NOTICE_ARCHIVE_DAYS * 24 * 60 * 60 * 1000);
  const archivedNotices = await db
    .update(noticesTable)
    .set({ archivedAt: now })
    .where(
      and(
        eq(noticesTable.isPinned, false),
        isNull(noticesTable.archivedAt),
        lt(noticesTable.createdAt, archiveBefore)
      )
    )
    .returning({ id: noticesTable.id });

  if (archivedNotices.length > 0) {
    logger.info({ count: archivedNotices.length }, "Notices auto-archived");
  }
}

export function startScheduler() {
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // run every 6 hours

  // Run immediately on startup
  runArchivingJob().catch((err) =>
    logger.error({ err }, "Error in initial archiving job")
  );

  // Then run every 6 hours
  setInterval(() => {
    runArchivingJob().catch((err) =>
      logger.error({ err }, "Error in scheduled archiving job")
    );
  }, INTERVAL_MS);

  logger.info({ intervalHours: 6 }, "Auto-archiving scheduler started");
}
