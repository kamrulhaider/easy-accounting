import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { AccountType, CommonStatus } from "@prisma/client";

// PATCH /accounts/:id
// Body: partial { name?, status?, accountType? }
export async function updateAccount(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { name, status, accountType } = req.body || {};

  if (!name && !status && !accountType) {
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

    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { companyId: true },
    });
    if (!user || user.companyId !== account.companyId)
      return res.status(403).json({ error: "Forbidden" });

    if (name) {
      const existing = await prisma.account.findFirst({
        where: { companyId: account.companyId, name, id: { not: id } },
      });
      if (existing)
        return res.status(400).json({ error: "Account name already exists" });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: {
        name: name ?? undefined,
        status: status ?? undefined,
        accountType: accountType ?? undefined,
        updatedById: actor.id,
      },
      select: {
        id: true,
        name: true,
        status: true,
        accountType: true,
        companyId: true,
        updatedAt: true,
      },
    });
    return res.json({ account: updated });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to update account" });
  }
}
