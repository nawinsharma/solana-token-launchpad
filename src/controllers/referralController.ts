import { Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middleware/auth";

export async function createReferral(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
    if (!launch) return res.status(404).json({ error: "Launch not found" });
    if (launch.creatorId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { code, discountPercent, maxUses } = req.body;
    if (!code || discountPercent == null || maxUses == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await prisma.referralCode.findUnique({
      where: { launchId_code: { launchId: launch.id, code } },
    });
    if (existing) return res.status(409).json({ error: "Duplicate referral code" });

    const referral = await prisma.referralCode.create({
      data: { launchId: launch.id, code, discountPercent, maxUses },
    });

    return res.status(201).json({
      id: referral.id,
      code: referral.code,
      discountPercent: referral.discountPercent,
      maxUses: referral.maxUses,
      usedCount: referral.usedCount,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listReferrals(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
    if (!launch) return res.status(404).json({ error: "Launch not found" });
    if (launch.creatorId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const referrals = await prisma.referralCode.findMany({ where: { launchId: launch.id } });
    return res.json(referrals);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

