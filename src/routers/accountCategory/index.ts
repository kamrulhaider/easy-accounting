import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../middlewares/auth";
import { createCategory } from "../../controllers/journal/accountCategory/createCategory";
import { getCategories } from "../../controllers/journal/accountCategory/getCategories";
import { updateCategory } from "../../controllers/journal/accountCategory/updateCategory";
import { deleteCategory } from "../../controllers/journal/accountCategory/deleteCategory";
import { moveAccounts } from "../../controllers/journal/accountCategory/moveAccounts";

export const accountCategoryRouter = Router();

// COMPANY_ADMIN can mutate; COMPANY_USER can read
accountCategoryRouter.post(
  "/",
  requireRole([UserRole.COMPANY_ADMIN]),
  createCategory
);
accountCategoryRouter.get(
  "/",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getCategories
);
accountCategoryRouter.patch(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN]),
  updateCategory
);
accountCategoryRouter.delete(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN]),
  deleteCategory
);

// Move all accounts from one category to another within the same company
accountCategoryRouter.post(
  "/move",
  requireRole([UserRole.COMPANY_ADMIN]),
  moveAccounts
);
