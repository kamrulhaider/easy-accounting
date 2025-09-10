import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./src/utils/password";

module.exports = async () => {
  // Ensure DATABASE_URL is set for test
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for tests");
  }
  // Push schema (faster than running full migrations for ephemeral test DB)
  execSync("npx prisma db push", { stdio: "inherit" });

  // Minimal seed: create a SUPER_ADMIN if not exists for convenience
  const prisma = new PrismaClient();
  const adminEmail = "test-admin@easyaccounting.com";
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!existing) {
    await prisma.user.create({
      data: {
        username: "testadmin",
        email: adminEmail,
        password: await hashPassword("TestAdmin123!"),
        userRole: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });
  }
  await prisma.$disconnect();
};
