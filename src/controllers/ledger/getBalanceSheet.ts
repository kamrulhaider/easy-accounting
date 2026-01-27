import { Request, Response } from "express";
import { CommonStatus, AccountType } from "@prisma/client";
import { prisma } from "../../prisma";

// GET /balance-sheet?companyId=...&startDate=&endDate=&status=
export async function getBalanceSheet(req: Request, res: Response) {
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
    // Only include Asset, Liability, Equity accounts
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        accountType: {
          in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY],
        },
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
        assets: { total: 0, accounts: [] },
        liabilities: { total: 0, accounts: [] },
        equity: { total: 0, accounts: [] },
        totals: {
          assets: 0,
          liabilities: 0,
          equity: 0,
          equationBalanced: true,
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

    // Build sections
    const assets: Array<{ id: string; name: string; balance: number }> = [];
    const liabilities: Array<{ id: string; name: string; balance: number }> =
      [];
    const equity: Array<{ id: string; name: string; balance: number }> = [];

    let assetsTotal = 0;
    let liabilitiesTotal = 0;
    let equityTotal = 0;

    for (const acc of accounts) {
      const sums = sumMap.get(acc.id) || { debit: 0, credit: 0 };
      const net = sums.debit - sums.credit; // debit minus credit

      if (acc.accountType === AccountType.ASSET) {
        const balance = net >= 0 ? net : 0; // assets have debit nature
        if (balance !== 0) {
          assets.push({ id: acc.id, name: acc.name, balance });
          assetsTotal += balance;
        }
      } else if (acc.accountType === AccountType.LIABILITY) {
        const balance = net < 0 ? -net : 0; // liabilities have credit nature
        if (balance !== 0) {
          liabilities.push({ id: acc.id, name: acc.name, balance });
          liabilitiesTotal += balance;
        }
      } else if (acc.accountType === AccountType.EQUITY) {
        const balance = net < 0 ? -net : 0; // equity has credit nature
        if (balance !== 0) {
          equity.push({ id: acc.id, name: acc.name, balance });
          equityTotal += balance;
        }
      }
    }

    const equationBalanced =
      Math.abs(assetsTotal - (liabilitiesTotal + equityTotal)) < 1e-6;

    return res.json({
      assets: { total: assetsTotal, accounts: assets },
      liabilities: { total: liabilitiesTotal, accounts: liabilities },
      equity: { total: equityTotal, accounts: equity },
      totals: {
        assets: assetsTotal,
        liabilities: liabilitiesTotal,
        equity: equityTotal,
        equationBalanced,
      },
      filters: {
        companyId,
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
        status: statusFilter ?? null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to fetch balance sheet" });
  }
}
