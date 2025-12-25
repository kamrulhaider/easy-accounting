import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole } from "@prisma/client";

// GET /users/:id
// Returns a single COMPANY_USER within the actor's company
export async function getCompanyUser(req: Request, res: Response) {
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

  const userId = req.params.id;
  if (!userId) {
    return res
      .status(400)
      .json({ error: "User id required", requestId: req.requestId });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId: actor.companyId,
        userRole: UserRole.COMPANY_USER,
        deletedAt: null,
      },
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
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found", requestId: req.requestId });
    }
    return res.json({ user });
  } catch (e: any) {
    logger.error({
      evt: "companyUsers:get:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to get user", requestId: req.requestId });
  }
}
