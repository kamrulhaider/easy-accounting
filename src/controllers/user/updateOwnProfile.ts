import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";

// PATCH /auth/me
// Body: { name?: string, phone?: string, address?: string }
// Updates the authenticated user's own profile fields.
export async function updateOwnProfile(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, phone, address } = req.body || {};

  const data: any = {};
  if (typeof name === "string") data.name = name;
  if (typeof phone === "string") data.phone = phone;
  if (typeof address === "string") data.address = address;

  if (Object.keys(data).length === 0) {
    return res
      .status(400)
      .json({ error: "No valid fields to update", requestId: req.requestId });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        userRole: true,
        status: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info({
      evt: "user:updateOwnProfile",
      userId: req.user.id,
      requestId: req.requestId,
    });

    return res.json({ user: updated });
  } catch (e: any) {
    logger.error({
      evt: "user:updateOwnProfile:error",
      err: e,
      userId: req.user.id,
      requestId: req.requestId,
    });
    return res.status(500).json({
      error: "Failed to update profile",
      requestId: req.requestId,
    });
  }
}
