import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { createCompany } from "../../controllers/company/createCompany";

export const companyRouter = Router();

companyRouter.post(
  "/",
  requireRole([UserRole.SUPER_ADMIN, UserRole.MODERATOR]),
  createCompany
);
