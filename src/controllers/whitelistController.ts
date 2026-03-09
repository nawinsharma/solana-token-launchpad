import { Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middleware/auth";

export async function addToWhitelist(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
    if (!launch) return res.status(404).json({ error: "Launch not found" });
    if (launch.creatorId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { addresses } = req.body;
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: "addresses array required" });
    }

    let added = 0;
    for (const address of addresses) {
      try {
        await prisma.whitelistEntry.create({
          data: { launchId: launch.id, address },
        });
        added++;
      } catch {
        // duplicate, skip
      }
    }

    const total = await prisma.whitelistEntry.count({ where: { launchId: launch.id } });
    return res.json({ added, total });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getWhitelist(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
    if (!launch) return res.status(404).json({ error: "Launch not found" });
    if (launch.creatorId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const entries = await prisma.whitelistEntry.findMany({ where: { launchId: launch.id } });
    return res.json({
      addresses: entries.map((e) => e.address),
      total: entries.length,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function removeFromWhitelist(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
    if (!launch) return res.status(404).json({ error: "Launch not found" });
    if (launch.creatorId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const entry = await prisma.whitelistEntry.findUnique({
      where: { launchId_address: { launchId: launch.id, address: req.params.address } },
    });
    if (!entry) return res.status(404).json({ error: "Address not found" });

    await prisma.whitelistEntry.delete({ where: { id: entry.id } });
    return res.json({ removed: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

