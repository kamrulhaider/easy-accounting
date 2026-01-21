import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { AccountType, UserRole } from "@prisma/client";

// GET /dashboard/company/profit-loss-12-months?companyId=
export async function getCompanyProfitLossLastYear(
  req: Request,
  res: Response,
) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { companyId: companyIdParam } = req.query;

  let companyId: string | undefined;
  const isElevated =
    actor.userRole === UserRole.SUPER_ADMIN ||
    actor.userRole === UserRole.MODERATOR;

  if (isElevated) {
    if (!companyIdParam || typeof companyIdParam !== "string") {
      return res.status(400).json({ error: "companyId required" });
    }
    companyId = companyIdParam;
  } else {
    if (!actor.companyId)
      return res.status(403).json({ error: "User has no company context" });
    if (
      companyIdParam &&
      typeof companyIdParam === "string" &&
      companyIdParam !== actor.companyId
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    companyId = actor.companyId;
  }

  try {
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      months.push(key);
    }
    const startDate = new Date(months[0] + "-01T00:00:00.000Z");

    const monthMap: Record<string, { revenue: number; expense: number }> = {};
    for (const m of months) {
      monthMap[m] = { revenue: 0, expense: 0 };
    }

    const lines = await prisma.journalLine.findMany({
      where: {
        deletedAt: null,
        journalEntry: {
          companyId,
          deletedAt: null,
          date: { gte: startDate },
        },
      },
      select: {
        debitAmount: true,
        creditAmount: true,
        journalEntry: {
          select: { date: true },
        },
        account: {
          select: { accountType: true },
        },
      },
    });

    for (const line of lines) {
      const monthKey = line.journalEntry.date.toISOString().slice(0, 7);
      if (!monthMap[monthKey]) continue;
      const debit = line.debitAmount || 0;
      const credit = line.creditAmount || 0;
      if (line.account.accountType === AccountType.REVENUE) {
        monthMap[monthKey].revenue += credit - debit;
      } else if (line.account.accountType === AccountType.EXPENSE) {
        monthMap[monthKey].expense += debit - credit;
      }
    }

    const data = months.map((month) => {
      const { revenue, expense } = monthMap[month];
      const net = revenue - expense;
      return { month, revenue, expense, net };
    });

    return res.json({
      companyId,
      period: {
        startMonth: months[0],
        endMonth: months[months.length - 1],
      },
      data,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch profit/loss chart data" });
  }
}
