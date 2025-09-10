import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@easyaccounting.com";
  const rawPassword = process.env.ADMIN_PASSWORD || "admin123";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashed = await hashPassword(rawPassword);
    await prisma.user.create({
      data: {
        username: "admin",
        email: adminEmail,
        password: hashed,
        userRole: "SUPER_ADMIN",
        status: "ACTIVE",
        name: "Admin",
      },
    });
    console.log("Admin user seeded (hashed password).");
  } else {
    // Upgrade legacy plaintext password if it doesn't look hashed (bcrypt hashes start with $2)
    if (!existingAdmin.password.startsWith("$2")) {
      const upgraded = await hashPassword(existingAdmin.password);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: upgraded },
      });
      console.log("Existing admin password upgraded to hashed.");
    } else {
      console.log("Admin user already exists (password hashed).");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
