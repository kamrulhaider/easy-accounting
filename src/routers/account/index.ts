import { Router } from "express";
import { createAccount } from "../../controllers/journal/account/createAccount";
import { getAccounts } from "../../controllers/journal/account/getAccounts";
import { getAccount } from "../../controllers/journal/account/getAccount";
import { updateAccount } from "../../controllers/journal/account/updateAccount";
import { deactivateAccount } from "../../controllers/journal/account/deactivateAccount";
import { requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

export const accountRouter = Router();

// Account routes: read access for COMPANY_ADMIN & COMPANY_USER; mutating actions restricted to COMPANY_ADMIN.
// Assumption: Only COMPANY_ADMIN should update/deactivate accounts (adjust if broader access desired).
accountRouter.post("/", requireRole([UserRole.COMPANY_ADMIN]), createAccount);
accountRouter.get(
  "/",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getAccounts
);
accountRouter.get(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]),
  getAccount
);
accountRouter.patch(
  "/:id",
  requireRole([UserRole.COMPANY_ADMIN]),
  updateAccount
);
accountRouter.patch(
  "/:id/deactivate",
  requireRole([UserRole.COMPANY_ADMIN]),
  deactivateAccount
);
