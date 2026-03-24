import { Router, type IRouter } from "express";
import { db, contactsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/contacts", async (_req, res) => {
  const contacts = await db.select().from(contactsTable);
  res.json(contacts);
});

export default router;
