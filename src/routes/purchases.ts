import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createPurchase,
  listPurchases,
} from "../controllers/purchaseController";

const router = Router({ mergeParams: true });

router.post("/", authMiddleware, createPurchase);
router.get("/", authMiddleware, listPurchases);

export default router;
