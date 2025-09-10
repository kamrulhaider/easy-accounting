import request from "supertest";
import { app } from "../src/index";
import { prisma } from "../src/prisma";
import { UserRole } from "@prisma/client";
import { verifyPassword, hashPassword } from "../src/utils/password";

// Helper to create a user with given role
async function createActor(role: UserRole, plainPassword = "PlainTemp123!") {
  const password = await hashPassword(plainPassword);
  return prisma.user.create({
    data: {
      username: `actor_${role}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`,
      email: `actor_${role}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}@example.com`,
      password,
      userRole: role,
      status: "ACTIVE",
    },
  });
}

async function getToken(emailOrUsername: string, password: string) {
  const res = await request(app)
    .post("/auth/login")
    .send({ emailOrUsername, password });
  return res.body.token as string | undefined;
}

describe("POST /companies", () => {
  afterAll(async () => {
    // Cleanup created rows (simple cleanup by truncating affected tables)
    // NOTE: For Postgres you could use TRUNCATE CASCADE; here we delete in order.
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
  });

  it("rejects when user not authorized", async () => {
    const actor = await createActor(UserRole.COMPANY_USER, "Secret123!");
    const token = await getToken(actor.email, "Secret123!");
    const res = await request(app)
      .post("/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        company: { name: "X", email: "x@example.com" },
        admin: {
          username: "xa",
          email: "xa@example.com",
          password: "Secret123!",
        },
      });
    expect(res.status).toBe(403);
  });

  it("creates company and hashes password", async () => {
    const actor = await createActor(UserRole.SUPER_ADMIN, "Secret123!");
    const token = await getToken(actor.email, "Secret123!");
    const adminEmail = `admin_${Date.now()}@example.com`;
    const adminUsername = `admin_${Date.now()}`;
    const res = await request(app)
      .post("/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        company: { name: "Acme Co", email: `acme_${Date.now()}@example.com` },
        admin: {
          username: adminUsername,
          email: adminEmail,
          password: "Secret123!",
          name: "Admin",
          phone: "123",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.admin).toBeDefined();
    const adminRecord = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    expect(adminRecord).toBeTruthy();
    expect(adminRecord!.password).not.toBe("Secret123!");
    const matches = await verifyPassword("Secret123!", adminRecord!.password);
    expect(matches).toBe(true);
  });
});
