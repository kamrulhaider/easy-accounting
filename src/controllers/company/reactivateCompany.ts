import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { UserRole } from "@prisma/client";

// PATCH /companies/:id/reactivate -> sets status ACTIVE
export async function reactivateCompany(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  // Only SUPER_ADMIN and MODERATOR may reactivate companies
  if (
    actor.userRole !== UserRole.SUPER_ADMIN &&
    actor.userRole !== UserRole.MODERATOR
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;

  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!company || company.deletedAt)
      return res.status(404).json({ error: "Company not found" });

    const updated = await prisma.company.update({
      where: { id },
      data: { status: "ACTIVE" },
      select: { id: true, name: true, status: true },
    });
    return res.json({ company: updated });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to reactivate company" });
  }
}
