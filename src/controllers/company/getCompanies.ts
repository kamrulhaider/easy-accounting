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

  // SUPER_ADMIN and MODERATOR can list all; COMPANY_ADMIN limited to their company
  const isElevated =
    actor.userRole === UserRole.SUPER_ADMIN ||
    actor.userRole === UserRole.MODERATOR;
  const isCompanyAdmin = actor.userRole === UserRole.COMPANY_ADMIN;
  if (!isElevated && !isCompanyAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const limitRaw =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const offsetRaw =
    typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;
  const includeDeletedParam =
    typeof req.query.includeDeleted === "string"
      ? req.query.includeDeleted.toLowerCase() === "true"
      : false;

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

    // Build effective where with role-based scoping and deleted flag
    let effectiveWhere: any = { ...where };
    if (!includeDeletedParam || !isElevated) {
      // Exclude soft-deleted unless elevated explicitly requests includeDeleted
      effectiveWhere.deletedAt = null;
    }
    if (isCompanyAdmin) {
      if (!actor.companyId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      effectiveWhere.id = actor.companyId;
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where: effectiveWhere,
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
          deletedAt: true,
        },
      }),
      prisma.company.count({ where: effectiveWhere }),
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
