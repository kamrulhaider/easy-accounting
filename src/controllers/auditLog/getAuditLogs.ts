import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole } from "@prisma/client";

// GET /audit-logs
// Query params (optional): companyId, userId, entity, action, limit, offset
export async function getAuditLogs(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // SUPER_ADMIN can see all; COMPANY_ADMIN can only see their company's logs
  const isSuperAdmin = actor.userRole === UserRole.SUPER_ADMIN;
  const isCompanyAdmin = actor.userRole === UserRole.COMPANY_ADMIN;

  if (!isSuperAdmin && !isCompanyAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const companyId =
    typeof req.query.companyId === "string"
      ? req.query.companyId.trim()
      : undefined;
  const userId =
    typeof req.query.userId === "string" ? req.query.userId.trim() : undefined;
  const entity =
    typeof req.query.entity === "string" ? req.query.entity.trim() : undefined;
  const action =
    typeof req.query.action === "string" ? req.query.action.trim() : undefined;
  const limitRaw =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const offsetRaw =
    typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  try {
    // Build where clause based on role and filters
    const where: any = {};

    // Role-based filtering
    if (isCompanyAdmin) {
      if (!actor.companyId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      where.companyId = actor.companyId;
    } else if (isSuperAdmin && companyId) {
      // Super admin can filter by company if provided
      where.companyId = companyId;
    }

    // Additional filters
    if (userId) {
      where.userId = userId;
    }
    if (entity) {
      where.entity = { contains: entity, mode: "insensitive" };
    }
    if (action) {
      where.action = { contains: action, mode: "insensitive" };
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          timestamp: true,
          companyId: true,
          userId: true,
          company: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true,
              userRole: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const itemsOnPage = auditLogs.length;
    const pageCount = limit > 0 ? Math.ceil(total / limit) : 1;
    const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
    const hasPrevPage = offset > 0;
    const hasNextPage = offset + itemsOnPage < total;
    const nextOffset = hasNextPage ? offset + limit : null;
    const prevOffset = hasPrevPage ? Math.max(0, offset - limit) : null;

    return res.json({
      auditLogs,
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
  } catch (e) {
    logger.error({
      evt: "auditLog:list:error",
      err: e,
      requestId: req.requestId,
    });
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
}
