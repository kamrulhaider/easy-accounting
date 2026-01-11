import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { createJournalEntry } from "../../controllers/journal/journalEntry/createJournalEntry";
import { getJournalEntry } from "../../controllers/journal/journalEntry/getJournalEntry";
import { getJournalEntries } from "../../controllers/journal/journalEntry/getJournalEntries";
import { updateJournalEntry } from "../../controllers/journal/journalEntry/updateJournalEntry";
import { deleteJournalEntry } from "../../controllers/journal/journalEntry/deleteJournalEntry";

export const journalEntryRouter = Router();

// Read
journalEntryRouter.get(
  "/",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getJournalEntries
);
journalEntryRouter.get(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getJournalEntry
);

journalEntryRouter.post(
  "/",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  createJournalEntry
);
journalEntryRouter.patch(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  updateJournalEntry
);
journalEntryRouter.delete(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN]),
  deleteJournalEntry
);
