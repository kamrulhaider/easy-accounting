import { Request, Response } from "express";
import { CommonStatus } from "@prisma/client";
import { prisma } from "../../prisma";

// GET /trial-balance?companyId=...&startDate=&endDate=&status=
export async function getTrialBalance(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { companyId, startDate, endDate, status } = req.query;
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId required" });
  }
  if (!actor.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (actor.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

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

  const statusFilter =
    typeof status === "string" &&
    Object.values(CommonStatus).includes(status as CommonStatus)
      ? (status as CommonStatus)
      : undefined;

  try {
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        accountType: true,
        status: true,
      },
    });

    if (accounts.length === 0) {
      return res.json({
        accounts: [],
        totals: {
          debit: 0,
          credit: 0,
          net: 0,
          debitBalance: 0,
          creditBalance: 0,
        },
        filters: {
          companyId,
          startDate: start ? start.toISOString() : null,
          endDate: end ? end.toISOString() : null,
          status: statusFilter ?? null,
        },
      });
    }

    const accountIds = accounts.map((a) => a.id);
    const whereLines: any = {
      accountId: { in: accountIds },
      deletedAt: null,
      journalEntry: {
        companyId,
        deletedAt: null,
        ...(start || end
          ? {
              date: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
    };

    const lineAgg = await prisma.journalLine.groupBy({
      by: ["accountId"],
      where: whereLines,
      _sum: { debitAmount: true, creditAmount: true },
    });

    const sumMap = new Map<string, { debit: number; credit: number }>();
    for (const row of lineAgg) {
      sumMap.set(row.accountId, {
        debit: row._sum.debitAmount || 0,
        credit: row._sum.creditAmount || 0,
      });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    let totalDebitBalance = 0;
    let totalCreditBalance = 0;

    const trialAccounts = accounts.map((acc) => {
      const sums = sumMap.get(acc.id) || { debit: 0, credit: 0 };
      const net = sums.debit - sums.credit;
      const debitBalance = net >= 0 ? net : 0;
      const creditBalance = net < 0 ? -net : 0;
      totalDebit += sums.debit;
      totalCredit += sums.credit;
      totalDebitBalance += debitBalance;
      totalCreditBalance += creditBalance;
      return {
        id: acc.id,
        name: acc.name,
        accountType: acc.accountType,
        status: acc.status,
        debit: sums.debit,
        credit: sums.credit,
        net,
        debitBalance,
        creditBalance,
      };
    });

    return res.json({
      accounts: trialAccounts,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        net: totalDebit - totalCredit,
        debitBalance: totalDebitBalance,
        creditBalance: totalCreditBalance,
      },
      filters: {
        companyId,
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
        status: statusFilter ?? null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to fetch trial balance" });
  }
}
