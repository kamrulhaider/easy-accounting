import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { createCompany } from "../../controllers/company/createCompany";
import { getCompanies } from "../../controllers/company/getCompanies";
import { updateCompany } from "../../controllers/company/updateCompany";
import { getCompany } from "../../controllers/company/getCompany";
import { deactivateCompany } from "../../controllers/company/deactivateCompany";
import { reactivateCompany } from "../../controllers/company/reactivateCompany";
import { deleteCompany } from "../../controllers/company/deleteCompany";

export const companyRouter = Router();

companyRouter.post("/", requireRole([UserRole.SUPER_ADMIN]), createCompany);

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

// GET /companies/:id - fetch a single company
companyRouter.get(
  "/:id",
  requireRole([UserRole.SUPER_ADMIN, UserRole.MODERATOR]),
  getCompany
);

// PATCH /companies/:id/deactivate
companyRouter.patch(
  "/:id/deactivate",
  requireRole([UserRole.SUPER_ADMIN]),
  deactivateCompany
);

// PATCH /companies/:id/reactivate
companyRouter.patch(
  "/:id/reactivate",
  requireRole([UserRole.SUPER_ADMIN, UserRole.MODERATOR]),
  reactivateCompany
);

// DELETE /companies/:id (soft delete)
companyRouter.delete(
  "/:id",
  requireRole([UserRole.SUPER_ADMIN]),
  deleteCompany
);
