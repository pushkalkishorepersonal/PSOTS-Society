import { Router, type IRouter } from "express";
import { db, contactsTable, insertContactSchema, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { postRateLimiter } from "../middlewares/rateLimiter";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/contacts", async (_req, res) => {
  const contacts = await db.select().from(contactsTable);
  res.json(contacts);
});

router.post("/contacts", postRateLimiter, requireAuth("admin"), async (req, res) => {
  const parsed = insertContactSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const [contact] = await db.insert(contactsTable).values(parsed.data).returning();

  await db.insert(auditLogsTable).values({
    action: "create",
    entityType: "contact",
    entityId: contact.id,
    userId: String(req.user!.sub),
    metadata: { name: contact.name, role: contact.role },
  });

  res.status(201).json(contact);
});

router.patch("/contacts/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = insertContactSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }

  const [contact] = await db.update(contactsTable).set(parsed.data).where(eq(contactsTable.id, id)).returning();

  await db.insert(auditLogsTable).values({
    action: "update",
    entityType: "contact",
    entityId: id,
    userId: String(req.user!.sub),
    changes: { before: existing, after: contact },
  });

  res.json(contact);
});

router.delete("/contacts/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }

  await db.delete(contactsTable).where(eq(contactsTable.id, id));

  await db.insert(auditLogsTable).values({
    action: "delete",
    entityType: "contact",
    entityId: id,
    userId: String(req.user!.sub),
    metadata: { name: existing.name },
  });

  res.status(204).send();
});

export default router;
