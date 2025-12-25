import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// DELETE /account-categories/:id
// Hard delete; accounts referencing it will be set to null via onDelete: SetNull
export async function deleteCategory(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;

  try {
    const category = await prisma.accountCategory.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });
    if (!actor.companyId || actor.companyId !== category.companyId)
      return res.status(403).json({ error: "Forbidden" });

    await prisma.accountCategory.delete({ where: { id } });
    return res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to delete category" });
  }
}
