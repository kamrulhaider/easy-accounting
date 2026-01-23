import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { logger } from "../../utils/logger";
import { UserRole } from "@prisma/client";

// PATCH /companies/my
// Body: { description?, address?, phone?, currency? }
export async function updateOwnCompany(req: Request, res: Response) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  // Only COMPANY_ADMIN may update their own company's info
  if (actor.userRole !== UserRole.COMPANY_ADMIN) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!actor.companyId) {
    return res
      .status(400)
      .json({ error: "User is not associated with a company" });
  }

  const payload = req.body || {};

  // Validate allowed fields only
  const updatable: any = {};
  if (typeof payload.description === "string")
    updatable.description = payload.description;
  if (typeof payload.address === "string") updatable.address = payload.address;
  if (typeof payload.phone === "string") updatable.phone = payload.phone;
  if (
    typeof payload.currency === "string" &&
    payload.currency.trim().length > 0
  )
    updatable.currency = payload.currency.trim();

  if (Object.keys(updatable).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    const updated = await prisma.company.update({
      where: { id: actor.companyId },
      data: { ...updatable },
      select: {
        id: true,
        name: true,
        email: true,
        description: true,
        address: true,
        phone: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return res.json({ company: updated });
  } catch (e: any) {
    logger.error({
      evt: "company:updateOwn:error",
      err: e,
      requestId: req.requestId,
      userId: actor.id,
      companyId: actor.companyId,
    });
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Company not found" });
    }
    return res
      .status(500)
      .json({ error: "Failed to update company", requestId: req.requestId });
  }
}
