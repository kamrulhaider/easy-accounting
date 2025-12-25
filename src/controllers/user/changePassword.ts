import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { verifyPassword, hashPassword } from "../../utils/password";
import { logger } from "../../utils/logger";

// POST /auth/change-password
// Body: { currentPassword: string, newPassword: string }
// Requires authenticated user (req.user injected by loadUser middleware)
export async function changePassword(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "currentPassword and newPassword required" });
  }
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: "newPassword must be at least 8 characters" });
  }
  if (newPassword === currentPassword) {
    return res
      .status(400)
      .json({ error: "newPassword must be different from currentPassword" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid current password" });
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
      select: { id: true },
    });

    return res.json({ message: "Password updated" });
  } catch (e: any) {
    logger.error({
      evt: "user:changePassword:error",
      err: e,
      requestId: req.requestId,
    });
    return res
      .status(500)
      .json({ error: "Failed to change password", requestId: req.requestId });
  }
}
