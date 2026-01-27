import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole } from "@prisma/client";
import { hashPassword } from "../../utils/password";

// POST /users/admins/:id/reset-password
// SUPER_ADMIN-only: reset a COMPANY_ADMIN user's password to a default value
export async function resetCompanyAdminPassword(req: Request, res: Response) {
  const actor = req.user;
  if (!actor || actor.userRole !== UserRole.SUPER_ADMIN) {
    return res
      .status(403)
      .json({ error: "Forbidden", requestId: req.requestId });
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

    if (existing.userRole !== UserRole.COMPANY_ADMIN) {
      return res
        .status(403)
        .json({ error: "Forbidden", requestId: req.requestId });
    }

    // Default reset password
    const defaultPassword = "12345678";
    const hashed = await hashPassword(defaultPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    logger.info({
      evt: "companyAdmins:resetPasswordBySuperAdmin",
      by: actor.id,
      target: userId,
      requestId: req.requestId,
    });

    return res.json({
      message: "Password reset to default",
      user: { id: userId, userRole: existing.userRole },
      defaultPassword,
    });
  } catch (e: any) {
    logger.error({
      evt: "companyAdmins:resetPassword:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to reset password", requestId: req.requestId });
  }
}
