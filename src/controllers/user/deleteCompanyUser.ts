import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole } from "@prisma/client";

// DELETE /users/:id
// Soft-deletes a COMPANY_USER within the actor's company
export async function deleteCompanyUser(req: Request, res: Response) {
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
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing || existing.deletedAt) {
      return res
        .status(404)
        .json({ error: "User not found", requestId: req.requestId });
    }
    if (
      existing.companyId !== actor.companyId ||
      existing.userRole !== UserRole.COMPANY_USER
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden", requestId: req.requestId });
    }

    // Prevent self-delete to avoid locking out the admin accidentally
    if (existing.id === actor.id) {
      return res
        .status(400)
        .json({ error: "Cannot delete yourself", requestId: req.requestId });
    }

    const deleted = await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
      select: { id: true },
    });

    logger.info({
      evt: "companyUsers:delete",
      by: actor.id,
      target: userId,
      requestId: req.requestId,
    });
    return res.json({ ok: true, id: deleted.id });
  } catch (e: any) {
    logger.error({
      evt: "companyUsers:delete:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to delete user", requestId: req.requestId });
  }
}
