import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { AccountType, CommonStatus } from "@prisma/client";

// GET /accounts?companyId=...&q=&type=&status=&categoryId=&limit=&offset=&all=true
export async function getAccounts(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { companyId, q, type, status, categoryId } = req.query;
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId required" });
  }

  // Use attached companyId from middleware
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

  const hasSearchQuery = typeof q === "string" && q.trim() !== "";

  const where: any = { companyId };
  if (hasSearchQuery) {
    where.name = { contains: q, mode: "insensitive" };
  }
  if (
    type &&
    typeof type === "string" &&
    Object.values(AccountType).includes(type as AccountType)
  ) {
    where.accountType = type;
  }

  const statusFilterProvided =
    typeof status === "string" &&
    Object.values(CommonStatus).includes(status as CommonStatus);
  if (statusFilterProvided) {
    where.status = status;
  } else if (!hasSearchQuery) {
    // Default behavior: list only active accounts unless user is searching.
    // Searching should be able to find inactive accounts too.
    where.status = CommonStatus.ACTIVE;
  }

  if (categoryId && typeof categoryId === "string") {
    if (categoryId === "null") {
      where.categoryId = null;
    } else {
      where.categoryId = categoryId;
    }
  }

  try {
    const [accounts, total, totalAccounts] = await Promise.all([
      prisma.account.findMany({
        where,
        orderBy: { name: "asc" },
        take: typeof limit === "number" ? limit : undefined,
        skip: offset,
        select: {
          id: true,
          name: true,
          accountType: true,
          status: true,
          companyId: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.account.count({ where }),
      prisma.account.count({ where: { companyId: companyId as string } }),
    ]);
    const itemsOnPage = accounts.length;
    const pageCount =
      typeof limit === "number" && limit > 0 ? Math.ceil(total / limit) : 1;
    const currentPage =
      typeof limit === "number" && limit > 0
        ? Math.floor(offset / limit) + 1
        : 1;
    return res.json({
      accounts,
      total,
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
    return res.status(500).json({ error: "Failed to fetch accounts" });
  }
}
