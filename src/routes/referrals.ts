import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createReferral,
  listReferrals,
} from "../controllers/referralController";

const router = Router({ mergeParams: true });

router.post("/", authMiddleware, createReferral);
router.get("/", authMiddleware, listReferrals);

export default router;
