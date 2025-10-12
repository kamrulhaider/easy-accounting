import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { AccountType, CommonStatus } from "@prisma/client";

// GET /accounts?companyId=...&q=&type=&status=&limit=&offset=
export async function getAccounts(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { companyId, q, type, status } = req.query;
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId required" });
  }

  // Look up user's company (middleware no longer sets companyId).
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { companyId: true },
  });
  if (!user || !user.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (user.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

  const limitRaw =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const offsetRaw =
    typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  const where: any = { companyId };
  if (q && typeof q === "string") {
    where.name = { contains: q, mode: "insensitive" };
  }
  if (
    type &&
    typeof type === "string" &&
    Object.values(AccountType).includes(type as AccountType)
  ) {
    where.accountType = type;
  }
  if (
    status &&
    typeof status === "string" &&
    Object.values(CommonStatus).includes(status as CommonStatus)
  ) {
    where.status = status;
  }

  try {
    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          accountType: true,
          status: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.account.count({ where }),
    ]);
    const itemsOnPage = accounts.length;
    const pageCount = limit > 0 ? Math.ceil(total / limit) : 1;
    const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
    return res.json({
      accounts,
      total,
      pagination: {
        limit,
        offset,
        currentPage,
        pageCount,
        itemsOnPage,
        hasNextPage: offset + itemsOnPage < total,
        hasPrevPage: offset > 0,
        nextOffset: offset + itemsOnPage < total ? offset + limit : null,
        prevOffset: offset > 0 ? Math.max(0, offset - limit) : null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to fetch accounts" });
  }
}
