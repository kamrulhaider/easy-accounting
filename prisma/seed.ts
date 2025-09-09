import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const adminEmail = "admin@easyaccounting.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: "admin",
        email: adminEmail,
        password: "admin123", // Change to a secure hash in production
        userRole: "SUPER_ADMIN",
        status: "ACTIVE",
        name: "Admin",
      },
    });
    console.log("Admin user seeded.");
  } else {
    console.log("Admin user already exists.");
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
