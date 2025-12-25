import { Request, Response } from "express";
import { prisma } from "../../../prisma";
import { roundHalfUp } from "../../../utils/round";

// PATCH /journal-entries/:id
// Body: { date?: string|Date, description?: string, lines?: [{ accountId, debitAmount?, creditAmount?, description? }] }
// If lines is provided, replaces all existing lines atomically and enforces balancing.
export async function updateJournalEntry(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { date, description, lines } = req.body || {};

  if (
    date === undefined &&
    description === undefined &&
    !Array.isArray(lines)
  ) {
    return res.status(400).json({ error: "No fields to update" });
  }
  let newDate: Date | undefined;
  if (date !== undefined) {
    const d = new Date(date);
    if (isNaN(d.getTime()))
      return res.status(400).json({ error: "Invalid date" });
    newDate = d;
  }

  // Validate lines if provided (apply half-up rounding to integers)
  if (lines !== undefined) {
    if (!Array.isArray(lines) || lines.length === 0) {
      return res
        .status(400)
        .json({ error: "lines must be a non-empty array when provided" });
    }
    let debitTotal = 0;
    let creditTotal = 0;
    const roundedLines = (lines as any[]).map((raw, idx) => {
      if (!raw || typeof raw.accountId !== "string")
        throw new Error(`lines[${idx}].accountId required`);
      const hasDebit =
        typeof raw.debitAmount === "number" && raw.debitAmount > 0;
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
      return res.status(400).json({
        error:
          "Entry must be balanced after rounding (total debits = total credits > 0)",
      });
    }
    // Replace req.body.lines with rounded
    (req as any).body.lines = roundedLines;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({ where: { id } });
      if (!entry || entry.deletedAt) throw new Error("Journal entry not found");
      if (!actor.companyId || actor.companyId !== entry.companyId)
        throw new Error("Forbidden");

      if (newDate !== undefined || description !== undefined) {
        await tx.journalEntry.update({
          where: { id },
          data: {
            date: newDate ?? undefined,
            description: description ?? undefined,
          },
        });
      }

      if (Array.isArray(lines)) {
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
          if (acc.companyId !== entry.companyId)
            throw new Error("Account does not belong to company");
          if (acc.status !== "ACTIVE") throw new Error("Account inactive");
        }

        await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
        await tx.journalLine.createMany({
          data: (lines as any[]).map((l: any) => ({
            journalEntryId: id,
            accountId: l.accountId,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            description: l.description ?? null,
          })),
        });
      }

      const full = await tx.journalEntry.findUnique({
        where: { id },
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

    return res.json({ entry: result });
  } catch (e: any) {
    const message =
      e.message === "Forbidden"
        ? "Forbidden"
        : e.message || "Failed to update journal entry";
    return res
      .status(message === "Forbidden" ? 403 : 400)
      .json({ error: message });
  }
}
