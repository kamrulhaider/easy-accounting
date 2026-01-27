import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { getBalanceSheet } from "../../controllers/ledger/getBalanceSheet";

export const balanceSheetRouter = Router();

balanceSheetRouter.get(
  "/",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getBalanceSheet,
);
