import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// PATCH /journal-entries/:entryId/lines/:lineId
// Body: { debitAmount?: number|null, creditAmount?: number|null, description?: string }
export async function updateJournalLine(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { entryId, lineId } = req.params as { entryId: string; lineId: string };
  const { debitAmount, creditAmount, description } = req.body || {};

  if (
    debitAmount === undefined &&
    creditAmount === undefined &&
    description === undefined
  ) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.journalLine.findUnique({
        where: { id: lineId },
        select: {
          id: true,
          journalEntryId: true,
          journalEntry: {
            select: { id: true, companyId: true, deletedAt: true },
          },
        },
      });
      if (
        !line ||
        line.journalEntryId !== entryId ||
        line.journalEntry.deletedAt
      )
        throw new Error("Line not found");
      if (!actor.companyId || actor.companyId !== line.journalEntry.companyId)
        throw new Error("Forbidden");

      // Ensure exactly one of debit or credit is set post-update (positive number); allow setting description only.
      let newDebit: number | null | undefined = debitAmount;
      let newCredit: number | null | undefined = creditAmount;

      if (
        newDebit !== undefined &&
        newDebit !== null &&
        typeof newDebit !== "number"
      )
        throw new Error("Invalid debitAmount");
      if (
        newCredit !== undefined &&
        newCredit !== null &&
        typeof newCredit !== "number"
      )
        throw new Error("Invalid creditAmount");

      // We enforce that both aren't positive simultaneously, and at least one is positive after considering unchanged values.
      const current = await tx.journalLine.findUnique({
        where: { id: lineId },
        select: { debitAmount: true, creditAmount: true },
      });
      const effDebit = newDebit === undefined ? current!.debitAmount : newDebit;
      const effCredit =
        newCredit === undefined ? current!.creditAmount : newCredit;

      const hasDebit = typeof effDebit === "number" && effDebit > 0;
      const hasCredit = typeof effCredit === "number" && effCredit > 0;
      if (hasDebit === hasCredit)
        throw new Error(
          "Line must have exactly one of debitAmount or creditAmount (> 0)"
        );

      await tx.journalLine.update({
        where: { id: lineId },
        data: {
          debitAmount: newDebit === undefined ? undefined : newDebit,
          creditAmount: newCredit === undefined ? undefined : newCredit,
          description: description === undefined ? undefined : description,
        },
      });

      // Validate entry remains balanced
      const agg = await tx.journalLine.aggregate({
        where: { journalEntryId: entryId },
        _sum: { debitAmount: true, creditAmount: true },
      });
      const debit = agg._sum.debitAmount || 0;
      const credit = agg._sum.creditAmount || 0;
      if (debit <= 0 || credit <= 0 || Math.abs(debit - credit) > 1e-9) {
        throw new Error("Entry must be balanced after changes");
      }

      const full = await tx.journalEntry.findUnique({
        where: { id: entryId },
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

    return res.json({ entry: result });
  } catch (e: any) {
    const message =
      e.message === "Forbidden"
        ? "Forbidden"
        : e.message || "Failed to update line";
    return res
      .status(message === "Forbidden" ? 403 : 400)
      .json({ error: message });
  }
}
