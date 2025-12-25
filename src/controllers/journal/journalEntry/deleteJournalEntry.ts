import { Request, Response } from "express";
import { prisma } from "../../../prisma";

// DELETE /journal-entries/:id (soft delete)
export async function deleteJournalEntry(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;

  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      select: { id: true, companyId: true, deletedAt: true },
    });
    if (!entry)
      return res.status(404).json({ error: "Journal entry not found" });
    if (!actor.companyId || actor.companyId !== entry.companyId)
      return res.status(403).json({ error: "Forbidden" });
    if (entry.deletedAt) return res.status(204).send();

    await prisma.journalEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to delete journal entry" });
  }
}
