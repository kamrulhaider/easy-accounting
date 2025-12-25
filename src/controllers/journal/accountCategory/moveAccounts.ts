import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// POST /account-categories/move
// Body: { companyId: string, fromCategoryId: string|null, toCategoryId: string|null }
// Moves all accounts in fromCategoryId to toCategoryId within the same company.
export async function moveAccounts(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { companyId, fromCategoryId, toCategoryId } = req.body || {};
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId required" });
  }

  if (!actor.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (actor.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

  // fromCategoryId and toCategoryId can be string or null
  const fromId: string | null = fromCategoryId === null ? null : fromCategoryId;
  const toId: string | null = toCategoryId === null ? null : toCategoryId;

  if (fromId !== null && typeof fromId !== "string")
    return res.status(400).json({ error: "Invalid fromCategoryId" });
  if (toId !== null && typeof toId !== "string")
    return res.status(400).json({ error: "Invalid toCategoryId" });

  if (fromId === toId) {
    return res.json({ moved: 0 });
  }

  try {
    // Validate categories exist and belong to the same company when provided
    if (fromId) {
      const from = await prisma.accountCategory.findUnique({
        where: { id: fromId },
        select: { id: true, companyId: true },
      });
      if (!from)
        return res.status(400).json({ error: "Invalid fromCategoryId" });
      if (from.companyId !== companyId)
        return res.status(403).json({ error: "Forbidden fromCategoryId" });
    }

    if (toId) {
      const to = await prisma.accountCategory.findUnique({
        where: { id: toId },
        select: { id: true, companyId: true },
      });
      if (!to) return res.status(400).json({ error: "Invalid toCategoryId" });
      if (to.companyId !== companyId)
        return res.status(403).json({ error: "Forbidden toCategoryId" });
    }

    const where: any = { companyId };
    if (fromId === null) where.categoryId = null;
    else where.categoryId = fromId;

    const result = await prisma.account.updateMany({
      where,
      data: { categoryId: toId },
    });

    return res.json({ moved: result.count });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to move accounts" });
  }
}
