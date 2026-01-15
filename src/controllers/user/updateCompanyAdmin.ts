import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole, CommonStatus } from "@prisma/client";

// PATCH /users/admins/:id
// SUPER_ADMIN-only: update basic fields for any COMPANY_ADMIN user (any company)
// Body: { name?, phone?, address?, status? }
export async function updateCompanyAdmin(req: Request, res: Response) {
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

  const { name, phone, address, status } = req.body || {};

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

    const data: any = {};
    if (typeof name === "string") data.name = name;
    if (typeof phone === "string") data.phone = phone;
    if (typeof address === "string") data.address = address;
    if (
      typeof status === "string" &&
      Object.values(CommonStatus).includes(status as CommonStatus)
    ) {
      data.status = status as CommonStatus;
    }

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields to update", requestId: req.requestId });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
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

    logger.info({
      evt: "companyAdmins:updateBySuperAdmin",
      by: actor.id,
      target: userId,
      requestId: req.requestId,
    });

    return res.json({ user: updated });
  } catch (e: any) {
    logger.error({
      evt: "companyAdmins:updateBySuperAdmin:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to update user", requestId: req.requestId });
  }
}
