import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole, CommonStatus } from "@prisma/client";

// GET /users/all
// SUPER_ADMIN-only: list all users in the application
// Query: q?, status?, role?, companyId?, limit?, offset?
export async function getAllUsers(req: Request, res: Response) {
  const actor = req.user;
  if (!actor || actor.userRole !== UserRole.SUPER_ADMIN) {
    return res
      .status(403)
      .json({ error: "Forbidden", requestId: req.requestId });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const statusParam =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const roleParam =
    typeof req.query.role === "string" ? req.query.role : undefined;
  const companyIdParam =
    typeof req.query.companyId === "string" ? req.query.companyId : undefined;

  const limitRaw =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const offsetRaw =
    typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  try {
    const where: any = {
      deletedAt: null,
    };

    if (q) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }

    if (
      statusParam &&
      Object.values(CommonStatus).includes(statusParam as CommonStatus)
    ) {
      where.status = statusParam as CommonStatus;
    }

    if (roleParam && Object.values(UserRole).includes(roleParam as UserRole)) {
      where.userRole = roleParam as UserRole;
    }

    if (companyIdParam) {
      where.companyId = companyIdParam;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          phone: true,
          address: true,
          status: true,
          userRole: true,
          companyId: true,
          company: {
            select: {
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const itemsOnPage = users.length;
    const pageCount = limit > 0 ? Math.ceil(total / limit) : 1;
    const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
    const hasPrevPage = offset > 0;
    const hasNextPage = offset + itemsOnPage < total;
    const nextOffset = hasNextPage ? offset + limit : null;
    const prevOffset = hasPrevPage ? Math.max(0, offset - limit) : null;

    return res.json({
      users,
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
      evt: "users:all:list:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to list users", requestId: req.requestId });
  }
}
