import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { UserRole } from "@prisma/client";

// GET /dashboard/company/journal-entries-12-months?companyId=
export async function getCompanyJournalCountLastYear(
  req: Request,
  res: Response,
) {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { companyId: companyIdParam } = req.query;

  let companyId: string | undefined;
  const isElevated =
    actor.userRole === UserRole.SUPER_ADMIN ||
    actor.userRole === UserRole.MODERATOR;

  if (isElevated) {
    if (!companyIdParam || typeof companyIdParam !== "string") {
      return res.status(400).json({ error: "companyId required" });
    }
    companyId = companyIdParam;
  } else {
    if (!actor.companyId)
      return res.status(403).json({ error: "User has no company context" });
    if (
      companyIdParam &&
      typeof companyIdParam === "string" &&
      companyIdParam !== actor.companyId
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    companyId = actor.companyId;
  }

  try {
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      months.push(key);
    }
    const startDate = new Date(months[0] + "-01T00:00:00.000Z");

    const counts: Record<string, number> = {};
    for (const m of months) {
      counts[m] = 0;
    }

    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        date: { gte: startDate },
      },
      select: {
        id: true,
        date: true,
      },
    });

    for (const entry of entries) {
      const monthKey = entry.date.toISOString().slice(0, 7);
      if (!counts[monthKey] && counts[monthKey] !== 0) continue;
      counts[monthKey] += 1;
    }

    const data = months.map((month) => ({
      month,
      count: counts[month] || 0,
    }));

    return res.json({
      companyId,
      period: {
        startMonth: months[0],
        endMonth: months[months.length - 1],
      },
      data,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch journal count chart data" });
  }
}
