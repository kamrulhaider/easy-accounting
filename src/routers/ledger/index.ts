import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { getLedger } from "../../controllers/ledger/getLedger";

export const ledgerRouter = Router();

ledgerRouter.get(
  "/",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getLedger
);
