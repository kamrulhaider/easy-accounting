import { prisma } from "./src/prisma";

beforeAll(async () => {
  // Optionally ensure connection
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
