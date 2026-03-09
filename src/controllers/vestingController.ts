import { Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middleware/auth";

export async function getVesting(req: AuthRequest, res: Response) {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      return res
        .status(400)
        .json({ error: "Missing walletAddress query parameter" });
    }

    const launch = await prisma.launch.findUnique({
      where: { id: req.params.id },
      include: { vesting: true },
    });
    if (!launch) return res.status(404).json({ error: "Launch not found" });

    const purchases = await prisma.purchase.aggregate({
      where: { launchId: launch.id, walletAddress },
      _sum: { amount: true },
    });
    const totalPurchased = purchases._sum.amount || 0;

    if (!launch.vesting) {
      return res.json({
        totalPurchased,
        tgeAmount: totalPurchased,
        cliffEndsAt: null,
        vestedAmount: totalPurchased,
        lockedAmount: 0,
        claimableAmount: totalPurchased,
      });
    }

    const { cliffDays, vestingDays, tgePercent } = launch.vesting;
    const tgeAmount = Math.floor((totalPurchased * tgePercent) / 100);
    const locked = totalPurchased - tgeAmount;

    const launchStart = new Date(launch.startsAt);
    const cliffEndsAt = new Date(
      launchStart.getTime() + cliffDays * 24 * 60 * 60 * 1000
    );
    const vestingEndsAt = new Date(
      cliffEndsAt.getTime() + vestingDays * 24 * 60 * 60 * 1000
    );
    const now = new Date();

    let vestedAmount = tgeAmount;
    let lockedAmount = locked;

    if (now >= vestingEndsAt) {
      vestedAmount = totalPurchased;
      lockedAmount = 0;
    } else if (now >= cliffEndsAt) {
      const elapsed = now.getTime() - cliffEndsAt.getTime();
      const totalVestingMs = vestingDays * 24 * 60 * 60 * 1000;
      const vestedFromLock = Math.floor(locked * (elapsed / totalVestingMs));
      vestedAmount = tgeAmount + vestedFromLock;
      lockedAmount = totalPurchased - vestedAmount;
    }

    return res.json({
      totalPurchased,
      tgeAmount,
      cliffEndsAt: cliffEndsAt.toISOString(),
      vestedAmount,
      lockedAmount,
      claimableAmount: vestedAmount,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

