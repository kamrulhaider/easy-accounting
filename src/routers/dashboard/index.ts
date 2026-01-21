import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { getCompanySummary } from "../../controllers/dashboard/getCompanySummary";
import { getCompanyProfitLossLastYear } from "../../controllers/dashboard/getCompanyProfitLossLastYear";
import { getCompanyJournalCountLastYear } from "../../controllers/dashboard/getCompanyJournalCountLastYear";

export const dashboardRouter = Router();

const companyRoles = [UserRole.COMPANY_USER, UserRole.COMPANY_ADMIN];

dashboardRouter.get(
  "/company/summary",
  requireRole(companyRoles),
  getCompanySummary,
);

dashboardRouter.get(
  "/company/profit-loss-12-months",
  requireRole(companyRoles),
  getCompanyProfitLossLastYear,
);

dashboardRouter.get(
  "/company/journal-entries-12-months",
  requireRole(companyRoles),
  getCompanyJournalCountLastYear,
);
