import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { CommonStatus } from "@prisma/client";
import { roundHalfUp } from "../../../utils/round";

// POST /journal-entries
// Body: { companyId: string, date: string|Date, description?: string, lines: [{ accountId: string, debitAmount?: number, creditAmount?: number, description?: string }] }
export async function createJournalEntry(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { companyId, date, description, lines } = req.body || {};
  if (!companyId || !date || !Array.isArray(lines) || lines.length === 0) {
    return res
      .status(400)
      .json({ error: "companyId, date, and non-empty lines required" });
  }
  if (!actor.companyId)
    return res.status(403).json({ error: "User has no company context" });
  if (actor.companyId !== companyId)
    return res.status(403).json({ error: "Forbidden" });

  const entryDate = new Date(date);
  if (isNaN(entryDate.getTime()))
    return res.status(400).json({ error: "Invalid date" });

  // Validate lines shape, round amounts half-up to integers, and compute totals
  let debitTotal = 0;
  let creditTotal = 0;
  const roundedLines = (lines as any[]).map((raw, idx) => {
    if (!raw || typeof raw.accountId !== "string")
      throw new Error(`lines[${idx}].accountId required`);
    const hasDebit = typeof raw.debitAmount === "number" && raw.debitAmount > 0;
    const hasCredit =
      typeof raw.creditAmount === "number" && raw.creditAmount > 0;
    if (hasDebit === hasCredit)
      throw new Error(
        `lines[${idx}] must have exactly one of debitAmount or creditAmount (> 0)`
      );
    const debit = hasDebit ? roundHalfUp(raw.debitAmount) : null;
    const credit = hasCredit ? roundHalfUp(raw.creditAmount) : null;
    if ((debit ?? 0) <= 0 && (credit ?? 0) <= 0)
      throw new Error(`lines[${idx}] rounded amount must be > 0`);
    if (raw.description && typeof raw.description !== "string")
      throw new Error(`lines[${idx}].description must be string`);
    if (debit !== null) debitTotal += debit;
    if (credit !== null) creditTotal += credit;
    return {
      accountId: raw.accountId,
      debitAmount: debit,
      creditAmount: credit,
      description: raw.description ?? null,
    };
  });
  if (debitTotal <= 0 || creditTotal <= 0 || debitTotal !== creditTotal) {
    return res
      .status(400)
      .json({
        error:
          "Entry must be balanced after rounding (total debits = total credits > 0)",
      });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Validate company exists and active
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, status: true },
      });
      if (!company) throw new Error("Company not found");
      if (company.status !== CommonStatus.ACTIVE)
        throw new Error("Company inactive");

      // Validate accounts belong to company and are active
      const accountIds = Array.from(
        new Set(lines.map((l: any) => l.accountId))
      );
      const accounts = await tx.account.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, companyId: true, status: true },
      });
      if (accounts.length !== accountIds.length)
        throw new Error("Some accounts not found");
      for (const acc of accounts) {
        if (acc.companyId !== companyId)
          throw new Error("Account does not belong to company");
        if (acc.status !== CommonStatus.ACTIVE)
          throw new Error("Account inactive");
      }

      const entry = await tx.journalEntry.create({
        data: { companyId, date: entryDate, description: description ?? null },
      });
      // Create lines
      await tx.journalLine.createMany({
        data: roundedLines.map((l: any) => ({
          journalEntryId: entry.id,
          accountId: l.accountId,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          description: l.description,
        })),
      });

      const full = await tx.journalEntry.findUnique({
        where: { id: entry.id },
        select: {
          id: true,
          date: true,
          description: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
          journalLines: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              accountId: true,
              debitAmount: true,
              creditAmount: true,
              description: true,
              createdAt: true,
              updatedAt: true,
              account: { select: { id: true, name: true, accountType: true } },
            },
          },
        },
      });
      return full!;
    });

    return res.status(201).json({ entry: created });
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: e.message || "Failed to create journal entry" });
  }
}
