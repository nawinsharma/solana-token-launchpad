import { Router } from "express";
import { getVesting } from "../controllers/vestingController";

const router = Router({ mergeParams: true });

router.get("/", getVesting);

export default router;
