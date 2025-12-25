import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// GET /journal-entries/:id
export async function getJournalEntry(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;

  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        description: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
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

    if (!entry || entry.deletedAt)
      return res.status(404).json({ error: "Journal entry not found" });
    if (!actor.companyId || actor.companyId !== entry.companyId)
      return res.status(403).json({ error: "Forbidden" });

    return res.json({ entry });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to fetch journal entry" });
  }
}
