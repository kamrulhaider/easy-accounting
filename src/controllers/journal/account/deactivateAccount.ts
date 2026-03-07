import { Request, Response } from "express";
import { prisma } from "../../../prisma";
// Router role middleware already restricts to COMPANY_ADMIN. We enforce company ownership below.

// PATCH /accounts/:id/deactivate
// If the account has no journal activity, delete it; otherwise set status INACTIVE.
export async function deactivateAccount(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  try {
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) return res.status(404).json({ error: "Account not found" });
    if (!actor.companyId || actor.companyId !== account.companyId)
      return res.status(403).json({ error: "Forbidden" });

    const journalLineCount = await prisma.journalLine.count({
      where: { accountId: id },
    });

    if (journalLineCount === 0) {
      const deleted = await prisma.account.delete({
        where: { id },
        select: { id: true, name: true, status: true },
      });
      return res.json({ account: deleted, deleted: true });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: { status: "INACTIVE" },
      select: { id: true, name: true, status: true },
    });
    return res.json({ account: updated, deleted: false });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to deactivate account" });
  }
}
