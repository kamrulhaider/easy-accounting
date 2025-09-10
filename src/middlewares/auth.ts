import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { UserRole } from "@prisma/client";
import { logger } from "../utils/logger";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

// Augment Express Request with user and requestId
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; userRole: UserRole };
      requestId?: string;
    }
  }
}

// Attach requestId and log start/finish
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  logger.info({
    evt: "request:start",
    method: req.method,
    url: req.originalUrl,
    requestId,
  });
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info({
      evt: "request:finish",
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
      requestId,
      userId: req.user?.id,
    });
  });
  next();
}

// Load user from header (placeholder auth)
export async function loadUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.header("authorization");
  let userId: string | undefined;
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.substring(7).trim();
    try {
      const secret = process.env.JWT_SECRET || "dev-secret-change";
      const decoded: any = jwt.verify(token, secret);
      userId = decoded.sub;
    } catch (e) {
      logger.warn({
        evt: "auth:token:invalid",
        reason: (e as Error).message,
        requestId: req.requestId,
      });
      return res
        .status(401)
        .json({ error: "Invalid or expired token", requestId: req.requestId });
    }
  }

  if (userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        req.user = { id: user.id, userRole: user.userRole };
      } else {
        return res
          .status(401)
          .json({ error: "User not found", requestId: req.requestId });
      }
    } catch (e) {
      logger.error({
        evt: "auth:userLookup:error",
        err: e,
        requestId: req.requestId,
      });
      return res
        .status(500)
        .json({ error: "Auth failure", requestId: req.requestId });
    }
  }
  next();
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.userRole)) {
      return res
        .status(403)
        .json({ error: "Forbidden", requestId: req.requestId });
    }
    next();
  };
}

// Central error handler
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status || 500;
  logger.error({
    evt: "request:error",
    err,
    status,
    method: req.method,
    url: req.originalUrl,
    requestId: req.requestId,
  });
  res.status(status).json({
    error: err.message || "Internal Server Error",
    requestId: req.requestId,
  });
}
