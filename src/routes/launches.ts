import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createLaunch,
  getLaunch,
  listLaunches,
  updateLaunch,
} from "../controllers/launchController";

const router = Router();

router.post("/", authMiddleware, createLaunch);
router.get("/", listLaunches);
router.get("/:id", getLaunch);
router.put("/:id", authMiddleware, updateLaunch);

export default router;
