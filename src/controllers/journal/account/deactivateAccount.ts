import { Request, Response } from "express";
import { prisma } from "../../../prisma";
// Router role middleware already restricts to COMPANY_ADMIN. We enforce company ownership below.

// PATCH /accounts/:id/deactivate -> sets status INACTIVE
export async function deactivateAccount(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  try {
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) return res.status(404).json({ error: "Account not found" });
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { companyId: true },
    });
    if (!user || user.companyId !== account.companyId)
      return res.status(403).json({ error: "Forbidden" });
    const updated = await prisma.account.update({
      where: { id },
      data: { status: "INACTIVE", updatedById: actor.id },
      select: { id: true, name: true, status: true },
    });
    return res.json({ account: updated });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to deactivate account" });
  }
}
