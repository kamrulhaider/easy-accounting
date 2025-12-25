import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// DELETE /journal-entries/:entryId/lines/:lineId
export async function deleteJournalLine(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { entryId, lineId } = req.params as { entryId: string; lineId: string };

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

      await tx.journalLine.delete({ where: { id: lineId } });

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

    return res.status(204).json({ entry: result });
  } catch (e: any) {
    const message =
      e.message === "Forbidden"
        ? "Forbidden"
        : e.message || "Failed to delete line";
    return res
      .status(message === "Forbidden" ? 403 : 400)
      .json({ error: message });
  }
}
