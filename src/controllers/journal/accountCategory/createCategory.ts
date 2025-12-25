import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// POST /account-categories
// Body: { companyId, name }
export async function createCategory(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { companyId, name } = req.body || {};
  if (!companyId || !name) {
    return res.status(400).json({ error: "companyId and name required" });
  }

  if (!actor.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (actor.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

  try {
    // Ensure company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) return res.status(404).json({ error: "Company not found" });

    const dup = await prisma.accountCategory.findFirst({
      where: { companyId, name },
    });
    if (dup)
      return res.status(400).json({ error: "Category name already exists" });

    const category = await prisma.accountCategory.create({
      data: { companyId, name },
      select: {
        id: true,
        name: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.status(201).json({ category });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to create category" });
  }
}
