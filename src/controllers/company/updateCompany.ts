import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole, CommonStatus } from "@prisma/client";

// PATCH /companies/:id
// Body: partial company fields to update (name, email, description, address, phone, status)
export async function updateCompany(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  // Only SUPER_ADMIN and MODERATOR may update companies
  if (
    actor.userRole !== UserRole.SUPER_ADMIN &&
    actor.userRole !== UserRole.MODERATOR
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const companyId = req.params.id;
  const payload = req.body || {};

  // Validate allowed fields
  const updatable: any = {};
  if (typeof payload.name === "string" && payload.name.trim().length > 0)
    updatable.name = payload.name.trim();
  if (typeof payload.email === "string" && payload.email.trim().length > 0)
    updatable.email = payload.email.trim();
  if (typeof payload.description === "string")
    updatable.description = payload.description;
  if (typeof payload.address === "string") updatable.address = payload.address;
  if (typeof payload.phone === "string") updatable.phone = payload.phone;
  if (
    typeof payload.status === "string" &&
    Object.values(CommonStatus).includes(payload.status as CommonStatus)
  )
    updatable.status = payload.status;

  if (Object.keys(updatable).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    // If updating email, ensure uniqueness
    if (updatable.email) {
      const exists = await prisma.company.findFirst({
        where: { email: updatable.email, id: { not: companyId } },
      });
      if (exists)
        return res
          .status(400)
          .json({ error: "Email already in use by another company" });
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { ...updatable },
      select: {
        id: true,
        name: true,
        email: true,
        description: true,
        address: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return res.json({ company: updated });
  } catch (e: any) {
    logger.error({
      evt: "company:update:error",
      err: e,
      requestId: req.requestId,
    });
    if (e.code === "P2025") {
      // Prisma: record to update not found
      return res.status(404).json({ error: "Company not found" });
    }
    return res
      .status(500)
      .json({ error: "Failed to update company", requestId: req.requestId });
  }
}
