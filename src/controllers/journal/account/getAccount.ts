import { Request, Response } from "express";
import { prisma } from "../../../prisma";
// Router-level role middleware restricts to company roles; we only need to ensure company ownership.

// GET /accounts/:id
export async function getAccount(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;

  try {
    const account = await prisma.account.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        accountType: true,
        status: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!account) return res.status(404).json({ error: "Account not found" });

    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { companyId: true },
    });
    if (!user || user.companyId !== account.companyId)
      return res.status(403).json({ error: "Forbidden" });

    return res.json({ account });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to fetch account" });
  }
}
