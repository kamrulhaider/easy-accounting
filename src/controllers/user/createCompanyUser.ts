import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { UserRole, CommonStatus } from "@prisma/client";
import { hashPassword } from "../../utils/password";
import { logger } from "../../utils/logger";

// POST /users
// Body: { username, email, password, name?, phone?, address?, status? }
// Creates a COMPANY_USER within the requesting COMPANY_ADMIN's company
export async function createCompanyUser(req: Request, res: Response) {
  const actor = req.user;
  if (!actor || actor.userRole !== UserRole.COMPANY_ADMIN) {
    return res
      .status(403)
      .json({ error: "Forbidden", requestId: req.requestId });
  }
  if (!actor.companyId) {
    return res
      .status(400)
      .json({ error: "No company context", requestId: req.requestId });
  }

  const { username, email, password, name, phone, address, status } =
    req.body || {};
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({
        error: "username, email, and password are required",
        requestId: req.requestId,
      });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      return res
        .status(409)
        .json({
          error: "username or email already exists",
          requestId: req.requestId,
        });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
        name: name ?? null,
        phone: phone ?? null,
        address: address ?? null,
        userRole: UserRole.COMPANY_USER,
        status: Object.values(CommonStatus).includes(status)
          ? (status as CommonStatus)
          : CommonStatus.ACTIVE,
        companyId: actor.companyId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        userRole: true,
        status: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info({
      evt: "companyUsers:create",
      by: actor.id,
      companyId: actor.companyId,
      userId: user.id,
      requestId: req.requestId,
    });
    return res.status(201).json({ user });
  } catch (e: any) {
    logger.error({
      evt: "companyUsers:create:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to create user", requestId: req.requestId });
  }
}
