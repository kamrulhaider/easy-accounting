import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { UserRole } from "@prisma/client";

// DELETE /companies/:id -> soft delete (set deletedAt)
export async function deleteCompany(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  // Only SUPER_ADMIN and MODERATOR may delete companies
  if (
    actor.userRole !== UserRole.SUPER_ADMIN &&
    actor.userRole !== UserRole.MODERATOR
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;

  try {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.deletedAt) return res.status(204).send();

    await prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    return res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to delete company" });
  }
}
