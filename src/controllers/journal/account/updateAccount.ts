import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { AccountType, CommonStatus } from "@prisma/client";

// PATCH /accounts/:id
// Body: partial { name?, status?, accountType?, categoryId? }
export async function updateAccount(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { name, status, accountType, categoryId } = req.body || {};

  if (!name && !status && !accountType && !("categoryId" in (req.body || {}))) {
    return res.status(400).json({ error: "No fields to update" });
  }
  if (accountType && !Object.values(AccountType).includes(accountType)) {
    return res.status(400).json({ error: "Invalid accountType" });
  }
  if (status && !Object.values(CommonStatus).includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) return res.status(404).json({ error: "Account not found" });

    if (!actor.companyId || actor.companyId !== account.companyId)
      return res.status(403).json({ error: "Forbidden" });

    if (name) {
      const existing = await prisma.account.findFirst({
        where: { companyId: account.companyId, name, id: { not: id } },
      });
      if (existing)
        return res.status(400).json({ error: "Account name already exists" });
    }

    let validatedCategoryId: string | null | undefined = undefined;
    if ("categoryId" in (req.body || {})) {
      if (categoryId === null) {
        validatedCategoryId = null;
      } else if (typeof categoryId === "string") {
        const category = await prisma.accountCategory.findUnique({
          where: { id: categoryId },
          select: { id: true, companyId: true },
        });
        if (!category)
          return res.status(400).json({ error: "Invalid categoryId" });
        if (category.companyId !== account.companyId)
          return res.status(403).json({ error: "Forbidden category" });
        validatedCategoryId = category.id;
      } else {
        return res.status(400).json({ error: "Invalid categoryId" });
      }
    }

    const updated = await prisma.account.update({
      where: { id },
      data: {
        name: name ?? undefined,
        status: status ?? undefined,
        accountType: accountType ?? undefined,
        categoryId: validatedCategoryId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        accountType: true,
        companyId: true,
        categoryId: true,
        updatedAt: true,
      },
    });
    return res.json({ account: updated });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to update account" });
  }
}
