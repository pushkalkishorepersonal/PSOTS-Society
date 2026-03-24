import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // create | update | delete | moderate | broadcast | rsvp
  entityType: text("entity_type").notNull(), // notice | listing | event | contact | setting | whatsapp_subscriber
  entityId: integer("entity_id"),
  userId: text("user_id"), // telegram user ID or IP
  changes: jsonb("changes"), // { before, after } for updates
  metadata: jsonb("metadata"), // extra context (IP, user agent, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
