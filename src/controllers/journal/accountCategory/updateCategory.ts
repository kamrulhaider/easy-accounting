import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// PATCH /account-categories/:id
// Body: { name }
export async function updateCategory(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const category = await prisma.accountCategory.findUnique({
      select: { id: true, name: true, companyId: true },
      where: { id },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });
    if (!actor.companyId || actor.companyId !== category.companyId)
      return res.status(403).json({ error: "Forbidden" });

    const dup = await prisma.accountCategory.findFirst({
      where: { companyId: category.companyId, name, id: { not: id } },
    });
    if (dup)
      return res.status(400).json({ error: "Category name already exists" });

    const updated = await prisma.accountCategory.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, companyId: true, updatedAt: true },
    });
    return res.json({ category: updated });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to update category" });
  }
}
