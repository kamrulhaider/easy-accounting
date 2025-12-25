import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// GET /journal-entries?companyId=...&q=&startDate=&endDate=&accountId=&limit=&offset=&all=true
export async function getJournalEntries(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { companyId, q, startDate, endDate, accountId } = req.query;
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId required" });
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

  const where: any = { companyId, deletedAt: null };
  if (q && typeof q === "string")
    where.description = { contains: q, mode: "insensitive" };
  if (start) where.date = { ...(where.date || {}), gte: start };
  if (end) where.date = { ...(where.date || {}), lte: end };

  try {
    // If filtering by accountId, we need entries having at least one matching line
    let entryIdsByAccount: string[] | undefined;
    if (accountId && typeof accountId === "string") {
      const lines = await prisma.journalLine.findMany({
        where: { accountId, journalEntry: { companyId, deletedAt: null } },
        select: { journalEntryId: true },
        distinct: ["journalEntryId"],
      });
      entryIdsByAccount = lines.map((l) => l.journalEntryId);
      if (entryIdsByAccount.length === 0) {
        return res.json({
          entries: [],
          total: 0,
          totals: { debit: 0, credit: 0 },
          pagination: {
            limit: typeof limit === "number" ? limit : null,
            offset,
            currentPage: 1,
            pageCount: 1,
            itemsOnPage: 0,
            hasNextPage: false,
            hasPrevPage: false,
            nextOffset: null,
            prevOffset: null,
          },
        });
      }
      where.id = { in: entryIdsByAccount };
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        orderBy: { date: "desc" },
        take: typeof limit === "number" ? limit : undefined,
        skip: offset,
        select: {
          id: true,
          date: true,
          description: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    // Aggregate totals for the fetched entries
    const ids = entries.map((e) => e.id);
    const lineAgg = ids.length
      ? await prisma.journalLine.groupBy({
          by: ["journalEntryId"],
          where: { journalEntryId: { in: ids } },
          _sum: { debitAmount: true, creditAmount: true },
        })
      : [];
    const sumMap = new Map<string, { debit: number; credit: number }>();
    for (const row of lineAgg as Array<{
      journalEntryId: string;
      _sum: { debitAmount: number | null; creditAmount: number | null };
    }>) {
      sumMap.set(row.journalEntryId, {
        debit: row._sum.debitAmount || 0,
        credit: row._sum.creditAmount || 0,
      });
    }

    const entriesWithTotals = entries.map((e) => ({
      ...e,
      totals: sumMap.get(e.id) || { debit: 0, credit: 0 },
    }));

    const itemsOnPage = entries.length;
    const pageCount =
      typeof limit === "number" && limit > 0 ? Math.ceil(total / limit) : 1;
    const currentPage =
      typeof limit === "number" && limit > 0
        ? Math.floor(offset / limit) + 1
        : 1;

    return res.json({
      entries: entriesWithTotals,
      total,
      totals: {
        debit: entriesWithTotals.reduce((s, e) => s + e.totals.debit, 0),
        credit: entriesWithTotals.reduce((s, e) => s + e.totals.credit, 0),
      },
      pagination: {
        limit: typeof limit === "number" ? limit : null,
        offset,
        currentPage,
        pageCount,
        itemsOnPage,
        hasNextPage:
          typeof limit === "number" ? offset + itemsOnPage < total : false,
        hasPrevPage: typeof limit === "number" ? offset > 0 : false,
        nextOffset:
          typeof limit === "number" && offset + itemsOnPage < total
            ? offset + (limit as number)
            : null,
        prevOffset:
          typeof limit === "number" && offset > 0
            ? Math.max(0, offset - (limit as number))
            : null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to fetch journal entries" });
  }
}
