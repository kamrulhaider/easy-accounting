import { Request, Response } from "express";
import { prisma } from "../../prisma";
import { hashPassword } from "../../utils/password";

// Controller handler: create a company plus its admin user
// Expects body: { company: {name,email,...}, admin: {username,email,password,...} }
export async function createCompany(req: Request, res: Response) {
  const actor = req.user!; // ensured by upstream authorization middleware
  const { company, admin } = req.body || {};

  if (!company?.name || !company?.email) {
    return res
      .status(400)
      .json({ error: "company.name and company.email required" });
  }
  if (!admin?.username || !admin?.email || !admin?.password) {
    return res.status(400).json({
      error: "admin.username, admin.email, admin.password required",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingCompany = await tx.company.findUnique({
        where: { email: company.email },
      });
      if (existingCompany) throw new Error("Company email already in use");

      const existingUser = await tx.user.findFirst({
        where: { OR: [{ email: admin.email }, { username: admin.username }] },
      });
      if (existingUser)
        throw new Error("Admin email or username already in use");

      const createdCompany = await tx.company.create({
        data: {
          name: company.name,
          email: company.email,
          description: company.description,
          address: company.address,
          phone: company.phone,
          // status defaults to ACTIVE via schema
        },
      });

      const passwordHash = await hashPassword(admin.password);

      const createdAdmin = await tx.user.create({
        data: {
          username: admin.username,
          email: admin.email,
          password: passwordHash,
          userRole: "COMPANY_ADMIN",
          status: "ACTIVE",
          name: admin.name,
          phone: admin.phone,
          address: admin.address,
          companyId: createdCompany.id,
        },
        select: {
          id: true,
          username: true,
          email: true,
          userRole: true,
          status: true,
          companyId: true,
          name: true,
          phone: true,
          address: true,
          createdAt: true,
        },
      });

      return { company: createdCompany, admin: createdAdmin };
    });

    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Creation failed" });
  }
}
