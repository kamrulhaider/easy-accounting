import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { getTrialBalance } from "../../controllers/ledger/getTrialBalance";

export const trialBalanceRouter = Router();

trialBalanceRouter.get(
  "/",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getTrialBalance
);
