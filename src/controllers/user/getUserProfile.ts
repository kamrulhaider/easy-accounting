import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";

// GET /auth/me
// Requires an authenticated user (Bearer token). Returns basic profile & company (if any).
export async function getUserProfile(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        userRole: true,
        status: true,
        name: true,
        phone: true,
        address: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            currency: true,
            description: true,
            address: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (e: any) {
    logger.error({
      evt: "user:profile:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to load profile", requestId: req.requestId });
  }
}
