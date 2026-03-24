import { db, listingsTable, noticesTable, settingsTable, SETTING_KEYS } from "@workspace/db";
import { and, eq, isNull, lt, isNotNull } from "drizzle-orm";
import { logger } from "./lib/logger";

async function getSettingNumber(key: string, fallback: number): Promise<number> {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (row) return Number(row.value) || fallback;
  } catch { /* use fallback */ }
  return fallback;
}

async function runArchivingJob() {
  const [listingExpiryDays, noticeArchiveDays] = await Promise.all([
    getSettingNumber(SETTING_KEYS.LISTING_EXPIRY_DAYS, 30),
    getSettingNumber(SETTING_KEYS.NOTICE_ARCHIVE_DAYS, 60),
  ]);

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
    logger.info({ count: expiredListings.length, expiryDays: listingExpiryDays }, "Listings auto-expired");
  }

  // 2. Archive old (non-pinned) notices older than noticeArchiveDays
  const archiveBefore = new Date(now.getTime() - noticeArchiveDays * 24 * 60 * 60 * 1000);
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
    logger.info({ count: archivedNotices.length, archiveDays: noticeArchiveDays }, "Notices auto-archived");
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
