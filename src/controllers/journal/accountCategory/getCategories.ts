import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// GET /account-categories?companyId=...&q=&limit=&offset=&all=true
export async function getCategories(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { companyId, q } = req.query;
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId required" });
  }
  if (!actor.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (actor.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

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

  const where: any = { companyId };
  if (q && typeof q === "string")
    where.name = { contains: q, mode: "insensitive" };

  try {
    const [categories, total] = await Promise.all([
      prisma.accountCategory.findMany({
        where,
        orderBy: { name: "asc" },
        take: typeof limit === "number" ? limit : undefined,
        skip: offset,
        select: {
          id: true,
          name: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.accountCategory.count({ where }),
    ]);

    // Compute account counts for the categories returned
    const ids = categories.map((c) => c.id);
    const counts = ids.length
      ? await prisma.account.groupBy({
          by: ["categoryId"],
          where: { companyId: companyId as string, categoryId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map<string, number>();
    for (const row of counts as Array<{
      categoryId: string | null;
      _count: { _all: number };
    }>) {
      if (row.categoryId) countMap.set(row.categoryId, row._count._all);
    }
    const categoriesWithCount = categories.map((c) => ({
      ...c,
      accountCount: countMap.get(c.id) ?? 0,
    }));
    // Count uncategorized accounts in this company
    const uncategorizedCount = await prisma.account.count({
      where: { companyId: companyId as string, categoryId: null },
    });

    const itemsOnPage = categories.length;
    const totalAccounts =
      (categoriesWithCount.reduce((sum, c) => sum + (c.accountCount || 0), 0) ||
        0) + (uncategorizedCount || 0);
    const pageCount =
      typeof limit === "number" && limit > 0 ? Math.ceil(total / limit) : 1;
    const currentPage =
      typeof limit === "number" && limit > 0
        ? Math.floor(offset / limit) + 1
        : 1;
    return res.json({
      categories: categoriesWithCount,
      total,
      uncategorizedCount,
      totalAccounts,
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
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
}
