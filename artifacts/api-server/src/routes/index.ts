import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import noticesRouter from "./notices";
import eventsRouter from "./events";
import listingsRouter from "./listings";
import contactsRouter from "./contacts";
import whatsappRouter from "./whatsapp";
import towersRouter from "./towers";
import settingsRouter from "./settings";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(noticesRouter);
router.use(eventsRouter);
router.use(listingsRouter);
router.use(contactsRouter);
router.use(whatsappRouter);
router.use(towersRouter);
router.use(settingsRouter);
router.use(auditRouter);

export default router;
