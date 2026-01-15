import { Router } from "express";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { createCompanyUser } from "../../controllers/user/createCompanyUser";
import { getCompanyUsers } from "../../controllers/user/getCompanyUsers";
import { getCompanyUser } from "../../controllers/user/getCompanyUser";
import { updateCompanyUser } from "../../controllers/user/updateCompanyUser";
import { deleteCompanyUser } from "../../controllers/user/deleteCompanyUser";
import { getAllUsers } from "../../controllers/user/getAllUsers";
import { updateCompanyAdmin } from "../../controllers/user/updateCompanyAdmin";

export const usersRouter = Router();

// SUPER_ADMIN-only: list all users across the application
usersRouter.get("/all", requireRole([UserRole.SUPER_ADMIN]), getAllUsers);

// SUPER_ADMIN-only: update any COMPANY_ADMIN user (any company)
usersRouter.patch(
  "/admins/:id",
  requireRole([UserRole.SUPER_ADMIN]),
  updateCompanyAdmin
);

// All other endpoints restricted to COMPANY_ADMIN within own company
usersRouter.post("/", requireRole([UserRole.COMPANY_ADMIN]), createCompanyUser);
usersRouter.get("/", requireRole([UserRole.COMPANY_ADMIN]), getCompanyUsers);
usersRouter.get("/:id", requireRole([UserRole.COMPANY_ADMIN]), getCompanyUser);
usersRouter.patch(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN]),
  updateCompanyUser
);
usersRouter.delete(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN]),
  deleteCompanyUser
);
