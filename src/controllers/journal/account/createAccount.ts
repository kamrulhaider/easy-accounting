import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { AccountType, CommonStatus } from "@prisma/client";

// POST /accounts
// Body: { companyId, name, accountType }
export async function createAccount(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { companyId, name, accountType } = req.body || {};

  if (!companyId || !name || !accountType) {
    return res
      .status(400)
      .json({ error: "companyId, name, accountType required" });
  }
  if (!Object.values(AccountType).includes(accountType)) {
    return res.status(400).json({ error: "Invalid accountType" });
  }

  // Fetch the authenticated user's company to enforce ownership (middleware does not attach companyId).
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { companyId: true },
  });
  if (!user || !user.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (user.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

  try {
    // Ensure company exists & active
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { id: true, status: true },
    });
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.status !== CommonStatus.ACTIVE)
      return res.status(400).json({ error: "Company inactive" });

    const existing = await prisma.account.findFirst({
      where: { companyId: user.companyId, name },
    });
    if (existing)
      return res
        .status(400)
        .json({ error: "Account name already exists in company" });

    const account = await prisma.account.create({
      data: {
        companyId: user.companyId,
        name,
        accountType,
        createdById: actor.id,
      },
      select: {
        id: true,
        name: true,
        accountType: true,
        status: true,
        companyId: true,
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
