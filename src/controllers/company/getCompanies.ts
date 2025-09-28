import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole, CommonStatus } from "@prisma/client";

// GET /companies
// Query params (optional): q (name or email search), status, limit, offset
export async function getCompanies(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Only SUPER_ADMIN and MODERATOR may list companies
  if (
    actor.userRole !== UserRole.SUPER_ADMIN &&
    actor.userRole !== UserRole.MODERATOR
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const limitRaw =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const offsetRaw =
    typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  try {
    // Build base where clause
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (
      status &&
      Object.values(CommonStatus).includes(status as CommonStatus)
    ) {
      where.status = status;
    }

    // No additional scoping: SUPER_ADMIN and MODERATOR see companies per filters

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          email: true,
          description: true,
          address: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
          updatedById: true,
        },
      }),
      prisma.company.count({ where }),
    ]);

    const itemsOnPage = companies.length;
    const pageCount = limit > 0 ? Math.ceil(total / limit) : 1;
    const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
    const hasPrevPage = offset > 0;
    const hasNextPage = offset + itemsOnPage < total;
    const nextOffset = hasNextPage ? offset + limit : null;
    const prevOffset = hasPrevPage ? Math.max(0, offset - limit) : null;

    return res.json({
      companies,
      total,
      pagination: {
        limit,
        offset,
        currentPage,
        pageCount,
        itemsOnPage,
        hasNextPage,
        hasPrevPage,
        nextOffset,
        prevOffset,
      },
    });
  } catch (e: any) {
    logger.error({
      evt: "companies:list:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to list companies", requestId: req.requestId });
  }
}
