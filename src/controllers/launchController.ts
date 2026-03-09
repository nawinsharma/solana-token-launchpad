import { Response } from "express";
import { z } from "zod";
import prisma from "../prisma";
import { AuthRequest } from "../middleware/auth";
import { computeStatus } from "../services/launchService";

const tierSchema = z.object({
  minAmount: z.number().nonnegative(),
  maxAmount: z.number().positive(),
  pricePerToken: z.number().positive(),
});

const vestingSchema = z.object({
  cliffDays: z.number().int().nonnegative(),
  vestingDays: z.number().int().positive(),
  tgePercent: z.number().min(0).max(100),
});

const baseLaunchSchema = z
  .object({
    name: z.string().min(1),
    symbol: z.string().min(1),
    totalSupply: z.number().positive(),
    pricePerToken: z.number().positive(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    maxPerWallet: z.number().positive(),
    description: z.string().optional().nullable(),
    tiers: z.array(tierSchema).optional(),
    vesting: vestingSchema.optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

const createLaunchSchema = baseLaunchSchema;

const updateLaunchSchema = z
  .object({
    name: z.string().min(1).optional(),
    symbol: z.string().min(1).optional(),
    totalSupply: z.number().positive().optional(),
    pricePerToken: z.number().positive().optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    maxPerWallet: z.number().positive().optional(),
    description: z.string().optional().nullable(),
    tiers: z.array(tierSchema).optional(),
    vesting: vestingSchema.optional(),
  })
  .refine((data) => {
    if (data.startsAt && data.endsAt) {
      return data.endsAt > data.startsAt;
    }
    return true;
  }, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export async function createLaunch(req: AuthRequest, res: Response) {
  try {
    const parsed = createLaunchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }

    const {
      name,
      symbol,
      totalSupply,
      pricePerToken,
      startsAt,
      endsAt,
      maxPerWallet,
      description,
      tiers,
      vesting,
    } = parsed.data;

    const launch = await prisma.launch.create({
      data: {
        name,
        symbol,
        totalSupply,
        pricePerToken,
        startsAt,
        endsAt,
        maxPerWallet,
        description: description || null,
        creatorId: req.userId!,
        ...(tiers && tiers.length > 0
          ? {
              tiers: {
                create: tiers.map((t) => ({
                  minAmount: t.minAmount,
                  maxAmount: t.maxAmount,
                  pricePerToken: t.pricePerToken,
                })),
              },
            }
          : {}),
        ...(vesting
          ? {
              vesting: {
                create: {
                  cliffDays: vesting.cliffDays,
                  vestingDays: vesting.vestingDays,
                  tgePercent: vesting.tgePercent,
                },
              },
            }
          : {}),
      },
      include: { tiers: true, vesting: true },
    });

    const status = await computeStatus(launch);
    return res.status(201).json({ ...launch, status });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listLaunches(req: AuthRequest, res: Response) {
  try {
    const rawPage = parseInt(req.query.page as string);
    const rawLimit = parseInt(req.query.limit as string);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;
    const statusFilter = req.query.status as string | undefined;
    const skip = (page - 1) * limit;

    const launches = await prisma.launch.findMany({
      include: { tiers: true, vesting: true },
      orderBy: { createdAt: "desc" },
    });

    const launchesWithStatus = await Promise.all(
      launches.map(async (l) => ({ ...l, status: await computeStatus(l) }))
    );

    const filtered = statusFilter
      ? launchesWithStatus.filter((l) => l.status === statusFilter)
      : launchesWithStatus;

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return res.json({ launches: paginated, total, page, limit });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getLaunch(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({
      where: { id: req.params.id },
      include: { tiers: true, vesting: true },
    });
    if (!launch) return res.status(404).json({ error: "Launch not found" });

    const status = await computeStatus(launch);
    return res.json({ ...launch, status });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateLaunch(req: AuthRequest, res: Response) {
  try {
    const launch = await prisma.launch.findUnique({
      where: { id: req.params.id },
      include: { tiers: true, vesting: true },
    });
    if (!launch) return res.status(404).json({ error: "Launch not found" });
    if (launch.creatorId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = updateLaunchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }

    const {
      name,
      symbol,
      totalSupply,
      pricePerToken,
      startsAt,
      endsAt,
      maxPerWallet,
      description,
      tiers,
      vesting,
    } = parsed.data;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (symbol !== undefined) updateData.symbol = symbol;
    if (totalSupply !== undefined) updateData.totalSupply = totalSupply;
    if (pricePerToken !== undefined) updateData.pricePerToken = pricePerToken;
    if (startsAt !== undefined) updateData.startsAt = startsAt;
    if (endsAt !== undefined) updateData.endsAt = endsAt;
    if (maxPerWallet !== undefined) updateData.maxPerWallet = maxPerWallet;
    if (description !== undefined) updateData.description = description;

    if (tiers !== undefined) {
      await prisma.tier.deleteMany({ where: { launchId: launch.id } });
      if (tiers.length > 0) {
        updateData.tiers = {
          create: tiers.map((t: any) => ({
            minAmount: t.minAmount,
            maxAmount: t.maxAmount,
            pricePerToken: t.pricePerToken,
          })),
        };
      }
    }

    if (vesting !== undefined) {
      await prisma.vesting.deleteMany({ where: { launchId: launch.id } });
      if (vesting) {
        updateData.vesting = {
          create: {
            cliffDays: vesting.cliffDays,
            vestingDays: vesting.vestingDays,
            tgePercent: vesting.tgePercent,
          },
        };
      }
    }

    const updated = await prisma.launch.update({
      where: { id: req.params.id },
      data: updateData,
      include: { tiers: true, vesting: true },
    });

    const status = await computeStatus(updated);
    return res.json({ ...updated, status });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

