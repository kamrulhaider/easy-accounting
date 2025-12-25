import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

type AuditContext = {
  userId?: string;
  companyId?: string;
  requestId?: string;
};

const auditContext = new AsyncLocalStorage<AuditContext>();

export const prisma = new PrismaClient();

export function runWithAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditContext.run(ctx, fn);
}

// Use a loose cast to remain compatible across Prisma versions
(prisma as any).$use(async (params: any, next: any) => {
  const result = await next(params);

  try {
    const model = params.model;
    const action = params.action;

    if (!model || model === "AuditLog") return result;

    // Only log single-record mutations we can reliably get an id for
    const loggableActions = ["create", "update", "upsert", "delete"] as const;
    if (!loggableActions.includes(action as any)) return result;

    const ctx = auditContext.getStore();
    if (!ctx?.userId) return result;

    // Attempt to resolve the mutated entity id from the mutation result
    // Many operations return the full record (create/update/upsert/delete)
    const entityId =
      result && typeof (result as any).id === "string"
        ? (result as any).id
        : undefined;
    if (!entityId) return result;

    // Derive companyId from context or mutation result
    let companyId: string | undefined = ctx.companyId ?? undefined;
    if (!companyId && result && typeof (result as any).companyId === "string") {
      companyId = (result as any).companyId as string;
    }
    if (
      !companyId &&
      model === "Company" &&
      typeof (result as any).id === "string"
    ) {
      companyId = (result as any).id as string;
    }
    if (!companyId) return result;

    // Swallow any audit logging error to avoid impacting the mutation
    await (prisma as any).auditLog.create({
      data: {
        action: action.toUpperCase(),
        entity: model,
        entityId,
        companyId,
        userId: ctx.userId,
      },
    });
  } catch (_) {
    // No-op: never break the main request due to audit logging
  }

  return result;
});
