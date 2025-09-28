import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { verifyPassword } from "../../utils/password";
import jwt from "jsonwebtoken";
import { logger } from "../../utils/logger";

// Simple helper to build JWT payload
function signToken(payload: object) {
  const secret = process.env.JWT_SECRET || "dev-secret-change";
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

// POST /auth/login
// Body: { emailOrUsername: string, password: string }
export async function loginUser(req: Request, res: Response) {
  const { emailOrUsername, password } = req.body || {};
  if (!emailOrUsername || !password) {
    return res
      .status(400)
      .json({ error: "emailOrUsername and password required" });
  }
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken({ sub: user.id, role: user.userRole });
    logger.info({ evt: "auth:login", userId: user.id, role: user.userRole });
    return res.json({
      token,
      user: {
        username: user.username,
        role: user.userRole,
      },
    });
  } catch (e: any) {
    logger.error({ evt: "auth:login:error", err: e });
    return res.status(500).json({ error: "Login failed" });
  }
}
