import { Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middleware/auth";
import { calculateTieredCost, computeStatus } from "../services/launchService";

export async function createPurchase(req: AuthRequest, res: Response) {
  try {
    const { walletAddress, amount, txSignature, referralCode } = req.body;
    if (!walletAddress || amount == null || !txSignature) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const launch = await prisma.launch.findUnique({
      where: { id: req.params.id },
      include: { tiers: true, vesting: true },
    });
    if (!launch) return res.status(404).json({ error: "Launch not found" });

    const status = await computeStatus(launch);
    if (status !== "ACTIVE") {
      return res.status(400).json({ error: `Launch is ${status}` });
    }

    const whitelistCount = await prisma.whitelistEntry.count({
      where: { launchId: launch.id },
    });
    if (whitelistCount > 0) {
      const onWhitelist = await prisma.whitelistEntry.findUnique({
        where: {
          launchId_address: { launchId: launch.id, address: walletAddress },
        },
      });
      if (!onWhitelist) {
        return res.status(400).json({ error: "Wallet not whitelisted" });
      }
    }

    const existingTx = await prisma.purchase.findUnique({ where: { txSignature } });
    if (existingTx) {
      return res.status(400).json({ error: "Duplicate transaction signature" });
    }

    const userPurchases = await prisma.purchase.aggregate({
      where: { launchId: launch.id, userId: req.userId! },
      _sum: { amount: true },
    });
    const userTotal = (userPurchases._sum.amount || 0) + amount;
    if (userTotal > launch.maxPerWallet) {
      return res.status(400).json({ error: "Exceeds max per wallet" });
    }

    const totalPurchased = await prisma.purchase.aggregate({
      where: { launchId: launch.id },
      _sum: { amount: true },
    });
    const supplyUsed = (totalPurchased._sum.amount || 0) + amount;
    if (supplyUsed > launch.totalSupply) {
      return res.status(400).json({ error: "Exceeds total supply" });
    }

    let totalCost = calculateTieredCost(
      amount,
      launch.tiers,
      launch.pricePerToken
    );

    if (referralCode) {
      const referral = await prisma.referralCode.findUnique({
        where: { launchId_code: { launchId: launch.id, code: referralCode } },
      });
      if (!referral) {
        return res.status(400).json({ error: "Invalid referral code" });
      }
      if (referral.usedCount >= referral.maxUses) {
        return res.status(400).json({ error: "Referral code exhausted" });
      }
      totalCost = totalCost * (1 - referral.discountPercent / 100);
      await prisma.referralCode.update({
        where: { id: referral.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    const purchase = await prisma.purchase.create({
      data: {
        launchId: launch.id,
        userId: req.userId!,
        walletAddress,
        amount,
        totalCost,
        txSignature,
        referralCode: referralCode || null,
      },
    });

    return res.status(201).json(purchase);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listPurchases(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
    if (!launch) return res.status(404).json({ error: "Launch not found" });

    const isCreator = launch.creatorId === req.userId;
    const where: any = { launchId: launch.id };
    if (!isCreator) {
      where.userId = req.userId;
    }

    const purchases = await prisma.purchase.findMany({ where });
    return res.json({ purchases, total: purchases.length });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

