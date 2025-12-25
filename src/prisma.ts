import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";
import { logger } from "./utils/logger";

type AuditContext = {
  userId?: string;
  companyId?: string;
  requestId?: string;
};

const auditContext = new AsyncLocalStorage<AuditContext>();

// Base (unwrapped) Prisma client – used internally to avoid recursive logging
const basePrisma = new PrismaClient();

export function runWithAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditContext.run(ctx, fn);
}

// Userland audit wrapper compatible with Prisma versions lacking $use
function wrapWithAudit<T extends object>(client: T, clientLabel = "root"): T {
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      // Special-case $transaction to wrap the transactional client
      if (prop === "$transaction") {
        const orig = Reflect.get(target, prop, receiver);
        return (...args: any[]) => {
          // Array form – pass through directly
          if (Array.isArray(args[0])) {
            return orig.apply(target, args);
          }
          // Callback form – wrap the provided transactional client
          const cb = args[0];
          const options = args[1];
          return basePrisma.$transaction(async (tx: any) => {
            const wrappedTx = new Proxy(tx, handler);
            return cb(wrappedTx);
          }, options);
        };
      }

      const value = Reflect.get(target, prop, receiver);

      // If this is a model delegate (heuristic: has CRUD methods), wrap its methods
      if (value && typeof value === "object") {
        const hasCrud = ["create", "update", "upsert", "delete"].every(
          (m) => typeof value[m] === "function"
        );
        if (hasCrud) {
          const modelName = String(prop);
          // Do not wrap AuditLog delegate to avoid recursion
          if (modelName === "auditLog" || modelName === "AuditLog") {
            return value;
          }

          return new Proxy(value, {
            get(dTarget, dProp, dReceiver) {
              const method = Reflect.get(dTarget, dProp, dReceiver);
              const loggable = ["create", "update", "upsert", "delete"]; // single-record ops
              if (
                typeof method === "function" &&
                loggable.includes(String(dProp))
              ) {
                return async (...mArgs: any[]) => {
                  const result = await method.apply(dTarget, mArgs);
                  try {
                    const ctx = auditContext.getStore();
                    if (!ctx?.userId) return result;

                    // Attempt to derive entityId from mutation result
                    const entityId =
                      result && typeof result.id === "string"
                        ? result.id
                        : undefined;
                    if (!entityId) return result;

                    // Derive companyId
                    let companyId: string | undefined =
                      ctx.companyId ?? undefined;
                    if (
                      !companyId &&
                      result &&
                      typeof (result as any).companyId === "string"
                    ) {
                      companyId = (result as any).companyId as string;
                    }
                    if (!companyId && modelName === "company") {
                      // Creating/updating Company itself – use its id
                      companyId = entityId;
                    }
                    if (!companyId) return result;

                    // Fire-and-forget audit log using the base client (no wrapping)
                    await (basePrisma as any).auditLog.create({
                      data: {
                        action: String(dProp).toUpperCase(),
                        entity:
                          modelName.charAt(0).toUpperCase() +
                          modelName.slice(1),
                        entityId,
                        companyId,
                        userId: ctx.userId,
                      },
                    });
                  } catch (e) {
                    // Never break main flow due to audit issues
                    logger.warn({
                      evt: "audit:log:error",
                      err: e,
                      model: String(prop),
                      op: String(dProp),
                      client: clientLabel,
                    });
                  }
                  return result;
                };
              }
              return method;
            },
          });
        }
      }

      return value;
    },
  };

  return new Proxy(client as any, handler) as any as T;
}

export const prisma: PrismaClient = wrapWithAudit(basePrisma);
