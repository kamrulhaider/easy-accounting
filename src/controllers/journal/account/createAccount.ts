import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { AccountType, CommonStatus } from "@prisma/client";

// POST /accounts
// Body: { companyId, name, accountType, categoryId? }
export async function createAccount(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { companyId, name, accountType, categoryId } = req.body || {};

  if (!companyId || !name || !accountType) {
    return res
      .status(400)
      .json({ error: "companyId, name, accountType required" });
  }
  if (!Object.values(AccountType).includes(accountType)) {
    return res.status(400).json({ error: "Invalid accountType" });
  }

  // Enforce ownership using attached companyId from middleware
  if (!actor.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (actor.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

  try {
    // Ensure company exists & active
    const company = await prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { id: true, status: true },
    });
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.status !== CommonStatus.ACTIVE)
      return res.status(400).json({ error: "Company inactive" });

    const existing = await prisma.account.findFirst({
      where: { companyId: actor.companyId, name },
    });
    if (existing)
      return res
        .status(400)
        .json({ error: "Account name already exists in company" });

    // Validate optional category belongs to the same company
    let validatedCategoryId: string | null | undefined = undefined;
    if (categoryId) {
      const category = await prisma.accountCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, companyId: true },
      });
      if (!category)
        return res.status(400).json({ error: "Invalid categoryId" });
      if (category.companyId !== actor.companyId)
        return res.status(403).json({ error: "Forbidden category" });
      validatedCategoryId = category.id;
    }

    const account = await prisma.account.create({
      data: {
        companyId: actor.companyId,
        name,
        accountType,
        categoryId: validatedCategoryId ?? null,
      },
      select: {
        id: true,
        name: true,
        accountType: true,
        status: true,
        companyId: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.status(201).json({ account });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e.message || "Failed to create account" });
  }
}
