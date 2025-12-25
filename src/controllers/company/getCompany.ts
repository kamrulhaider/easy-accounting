import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { UserRole } from "@prisma/client";

// GET /companies/:id -> fetch a single company
export async function getCompany(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  // SUPER_ADMIN or MODERATOR can fetch any company
  // COMPANY_ADMIN can fetch only their own company
  const canFetchAny =
    actor.userRole === UserRole.SUPER_ADMIN ||
    actor.userRole === UserRole.MODERATOR;

  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        description: true,
        address: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.deletedAt)
      return res.status(404).json({ error: "Company not found" });

    if (!canFetchAny) {
      if (!actor.companyId || actor.companyId !== company.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.json({ company });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to get company" });
  }
}
