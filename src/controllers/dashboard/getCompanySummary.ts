import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { AccountType, CommonStatus, UserRole } from "@prisma/client";

// GET /dashboard/company/summary?companyId=&startDate=&endDate=
export async function getCompanySummary(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { companyId: companyIdParam, startDate, endDate } = req.query;

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

  const start =
    typeof startDate === "string" && startDate.length
      ? new Date(startDate)
      : undefined;
  const end =
    typeof endDate === "string" && endDate.length
      ? new Date(endDate)
      : undefined;
  if (start && isNaN(start.getTime()))
    return res.status(400).json({ error: "Invalid startDate" });
  if (end && isNaN(end.getTime()))
    return res.status(400).json({ error: "Invalid endDate" });
  if (start && end && start > end)
    return res
      .status(400)
      .json({ error: "startDate must be before or equal to endDate" });

  try {
    const lineWhere: any = {
      deletedAt: null,
      journalEntry: {
        companyId,
        deletedAt: null,
      },
    };
    if (start || end) {
      lineWhere.journalEntry.date = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      };
    }

    const journalWhere: any = {
      companyId,
      deletedAt: null,
    };
    if (start || end) {
      journalWhere.date = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      };
    }

    const [lines, journalEntryCount, activeAccountCount] = await Promise.all([
      prisma.journalLine.findMany({
        where: lineWhere,
        select: {
          debitAmount: true,
          creditAmount: true,
          account: {
            select: { accountType: true },
          },
        },
      }),
      prisma.journalEntry.count({ where: journalWhere }),
      prisma.account.count({
        where: { companyId, status: CommonStatus.ACTIVE },
      }),
    ]);

    let totalRevenue = 0;
    let totalExpense = 0;

    for (const line of lines) {
      const debit = line.debitAmount || 0;
      const credit = line.creditAmount || 0;
      if (line.account.accountType === AccountType.REVENUE) {
        totalRevenue += credit - debit;
      } else if (line.account.accountType === AccountType.EXPENSE) {
        totalExpense += debit - credit;
      }
    }

    const netProfit = totalRevenue - totalExpense;

    return res.json({
      companyId,
      period: {
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
      },
      summary: {
        totalRevenue,
        totalExpense,
        netProfit,
        journalEntryCount,
        activeAccountCount,
      },
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch company dashboard summary" });
  }
}
