import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  addToWhitelist,
  getWhitelist,
  removeFromWhitelist,
} from "../controllers/whitelistController";

const router = Router({ mergeParams: true });

router.post("/", authMiddleware, addToWhitelist);
router.get("/", authMiddleware, getWhitelist);
router.delete("/:address", authMiddleware, removeFromWhitelist);

export default router;
