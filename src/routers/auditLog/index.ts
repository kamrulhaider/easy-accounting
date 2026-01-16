import { Router } from "express";
import { getAuditLogs } from "../../controllers/auditLog/getAuditLogs";
import { UserRole } from "@prisma/client";

function requireRole(roles: UserRole[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export const auditLogRouter = Router();

// GET /audit-logs - list audit logs with pagination
auditLogRouter.get(
  "/",
  requireRole([UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]),
  getAuditLogs
);
