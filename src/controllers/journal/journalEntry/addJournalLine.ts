import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { CommonStatus } from "@prisma/client";

// POST /journal-entries/:id/lines
// Body: { accountId: string, debitAmount?: number, creditAmount?: number, description?: string }
export async function addJournalLine(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params; // journal entry id
  const { accountId, debitAmount, creditAmount, description } = req.body || {};

  const hasDebit = typeof debitAmount === "number" && debitAmount > 0;
  const hasCredit = typeof creditAmount === "number" && creditAmount > 0;
  if (!accountId || hasDebit === hasCredit)
    return res
      .status(400)
      .json({
        error:
          "accountId and exactly one of debitAmount or creditAmount required",
      });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        select: { id: true, companyId: true, deletedAt: true },
      });
      if (!entry || entry.deletedAt) throw new Error("Journal entry not found");
      if (!actor.companyId || actor.companyId !== entry.companyId)
        throw new Error("Forbidden");

      const account = await tx.account.findUnique({
        where: { id: accountId },
        select: { id: true, companyId: true, status: true },
      });
      if (!account) throw new Error("Account not found");
      if (account.companyId !== entry.companyId)
        throw new Error("Account not in company");
      if (account.status !== CommonStatus.ACTIVE)
        throw new Error("Account inactive");

      await tx.journalLine.create({
        data: {
          journalEntryId: entry.id,
          accountId,
          debitAmount: hasDebit ? debitAmount : null,
          creditAmount: hasCredit ? creditAmount : null,
          description: description ?? null,
        },
      });

      // Validate entry remains balanced
      const agg = await tx.journalLine.aggregate({
        where: { journalEntryId: entry.id },
        _sum: { debitAmount: true, creditAmount: true },
      });
      const debit = agg._sum.debitAmount || 0;
      const credit = agg._sum.creditAmount || 0;
      if (debit <= 0 || credit <= 0 || Math.abs(debit - credit) > 1e-9) {
        throw new Error("Entry must be balanced after changes");
      }

      const full = await tx.journalEntry.findUnique({
        where: { id: entry.id },
        select: {
          id: true,
          date: true,
          description: true,
          companyId: true,
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

    return res.status(201).json({ entry: result });
  } catch (e: any) {
    const message =
      e.message === "Forbidden"
        ? "Forbidden"
        : e.message || "Failed to add line";
    return res
      .status(message === "Forbidden" ? 403 : 400)
      .json({ error: message });
  }
}
