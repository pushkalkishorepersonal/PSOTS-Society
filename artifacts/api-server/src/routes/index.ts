import { Router, type IRouter } from "express";
import healthRouter from "./health";
import noticesRouter from "./notices";
import eventsRouter from "./events";
import listingsRouter from "./listings";
import contactsRouter from "./contacts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(noticesRouter);
router.use(eventsRouter);
router.use(listingsRouter);
router.use(contactsRouter);

export default router;
