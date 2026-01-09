import { Request, Response } from "express";
import { prisma } from "../../prisma";

// GET /ledger?companyId=...&accountId=...&startDate=&endDate=&limit=&offset=&all=true
export async function getLedger(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { companyId, accountId, startDate, endDate } = req.query;
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId required" });
  }
  if (!accountId || typeof accountId !== "string") {
    return res.status(400).json({ error: "accountId required" });
  }

  if (!actor.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (actor.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

  const start = typeof startDate === "string" ? new Date(startDate) : undefined;
  const end = typeof endDate === "string" ? new Date(endDate) : undefined;
  if (start && isNaN(start.getTime()))
    return res.status(400).json({ error: "Invalid startDate" });
  if (end && isNaN(end.getTime()))
    return res.status(400).json({ error: "Invalid endDate" });

  const limitRaw =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const offsetRaw =
    typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;
  const allParam =
    typeof req.query.all === "string"
      ? req.query.all.toLowerCase() === "true"
      : false;
  const limit = allParam
    ? undefined
    : Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 50;
  const offset = allParam
    ? 0
    : Number.isFinite(offsetRaw) && offsetRaw > 0
    ? offsetRaw
    : 0;

  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        accountType: true,
        status: true,
        companyId: true,
      },
    });
    if (!account || account.companyId !== companyId)
      return res.status(404).json({ error: "Account not found" });

    const where: any = {
      accountId,
      deletedAt: null,
      journalEntry: {
        companyId,
        deletedAt: null,
      },
    };
    if (start || end) {
      where.journalEntry.date = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      };
    }

    const ordering = [
      { journalEntry: { date: "asc" as const } },
      { createdAt: "asc" as const },
      { id: "asc" as const },
    ];

    const [lineCount, sumAgg] = await Promise.all([
      prisma.journalLine.count({ where }),
      prisma.journalLine.aggregate({
        where,
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    let startBalance = 0;
    if (offset > 0) {
      const priorLines = await prisma.journalLine.findMany({
        where,
        orderBy: ordering,
        take: offset,
        select: { debitAmount: true, creditAmount: true },
      });
      startBalance = priorLines.reduce((sum, line) => {
        return sum + (line.debitAmount || 0) - (line.creditAmount || 0);
      }, 0);
    }

    const lines = await prisma.journalLine.findMany({
      where,
      orderBy: ordering,
      skip: offset,
      take: typeof limit === "number" ? limit : undefined,
      select: {
        id: true,
        debitAmount: true,
        creditAmount: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        journalEntry: {
          select: {
            id: true,
            date: true,
            description: true,
          },
        },
      },
    });

    let running = startBalance;
    const linesWithBalance = lines.map((line) => {
      const delta = (line.debitAmount || 0) - (line.creditAmount || 0);
      running += delta;
      return {
        id: line.id,
        date: line.journalEntry.date,
        journalEntryId: line.journalEntry.id,
        journalEntryDescription: line.journalEntry.description,
        description: line.description,
        debitAmount: line.debitAmount || 0,
        creditAmount: line.creditAmount || 0,
        balance: running,
        createdAt: line.createdAt,
        updatedAt: line.updatedAt,
      };
    });

    const debitTotal = sumAgg._sum.debitAmount || 0;
    const creditTotal = sumAgg._sum.creditAmount || 0;

    const itemsOnPage = lines.length;
    const pageCount =
      typeof limit === "number" && limit > 0 ? Math.ceil(lineCount / limit) : 1;
    const currentPage =
      typeof limit === "number" && limit > 0
        ? Math.floor(offset / limit) + 1
        : 1;

    return res.json({
      account: {
        id: account.id,
        name: account.name,
        accountType: account.accountType,
        status: account.status,
      },
      lines: linesWithBalance,
      totals: {
        debit: debitTotal,
        credit: creditTotal,
        net: debitTotal - creditTotal,
      },
      pagination: {
        limit: typeof limit === "number" ? limit : null,
        offset,
        currentPage,
        pageCount,
        itemsOnPage,
        hasNextPage:
          typeof limit === "number" ? offset + itemsOnPage < lineCount : false,
        hasPrevPage: typeof limit === "number" ? offset > 0 : false,
        nextOffset:
          typeof limit === "number" && offset + itemsOnPage < lineCount
            ? offset + (limit as number)
            : null,
        prevOffset:
          typeof limit === "number" && offset > 0
            ? Math.max(0, offset - (limit as number))
            : null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to fetch ledger" });
  }
}
