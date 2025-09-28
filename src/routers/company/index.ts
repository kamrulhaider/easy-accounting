import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { createCompany } from "../../controllers/company/createCompany";
import { getCompanies } from "../../controllers/company/getCompanies";
import { updateCompany } from "../../controllers/company/updateCompany";

export const companyRouter = Router();

companyRouter.post(
  "/",
  requireRole([UserRole.SUPER_ADMIN, UserRole.MODERATOR]),
  createCompany
);

// GET /companies - returns paginated companies. Controller enforces role-scoping.
companyRouter.get(
  "/",
  requireRole([UserRole.SUPER_ADMIN, UserRole.MODERATOR]),
  getCompanies
);

companyRouter.patch(
  "/:id",
  requireRole([UserRole.SUPER_ADMIN, UserRole.MODERATOR]),
  updateCompany
);
