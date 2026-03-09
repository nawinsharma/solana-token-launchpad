import prisma from "../prisma";

export async function computeStatus(launch: {
  id: string;
  totalSupply: number;
  startsAt: Date;
  endsAt: Date;
}): Promise<string> {
  const totalPurchased = await prisma.purchase.aggregate({
    where: { launchId: launch.id },
    _sum: { amount: true },
  });
  const purchased = totalPurchased._sum.amount || 0;

  if (purchased >= launch.totalSupply) return "SOLD_OUT";

  const now = new Date();
  if (now < new Date(launch.startsAt)) return "UPCOMING";
  if (now > new Date(launch.endsAt)) return "ENDED";
  return "ACTIVE";
}

export function calculateTieredCost(
  amount: number,
  tiers: { minAmount: number; maxAmount: number; pricePerToken: number }[] | null | undefined,
  flatPrice: number
): number {
  if (!tiers || tiers.length === 0) {
    return amount * flatPrice;
  }

  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  let remaining = amount;
  let cost = 0;

  for (const tier of sorted) {
    if (remaining <= 0) break;
    const tierCapacity = tier.maxAmount - tier.minAmount;
    const fillAmount = Math.min(remaining, tierCapacity);
    cost += fillAmount * tier.pricePerToken;
    remaining -= fillAmount;
  }

  if (remaining > 0) {
    cost += remaining * flatPrice;
  }

  return cost;
}

