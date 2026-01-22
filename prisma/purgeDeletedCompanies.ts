import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function purgeCompany(companyId: string, dryRun: boolean) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, email: true, deletedAt: true },
  });

  if (!company) {
    console.log(`Company ${companyId} not found, skipping.`);
    return;
  }

  if (!company.deletedAt) {
    console.log(
      `Company ${company.id} (${company.name}) is not soft-deleted (deletedAt is null), skipping.`,
    );
    return;
  }

  const [
    userCount,
    accountCount,
    categoryCount,
    journalEntryCount,
    journalLineCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.user.count({ where: { companyId: company.id } }),
    prisma.account.count({ where: { companyId: company.id } }),
    prisma.accountCategory.count({ where: { companyId: company.id } }),
    prisma.journalEntry.count({ where: { companyId: company.id } }),
    prisma.journalLine.count({
      where: {
        journalEntry: { companyId: company.id },
      },
    }),
    prisma.auditLog.count({ where: { companyId: company.id } }),
  ]);

  console.log("========================================");
  console.log(`Company: ${company.id} (${company.name}) <${company.email}>`);
  console.log(`Soft-deleted at: ${company.deletedAt?.toISOString()}`);
  console.log("Related records:");
  console.log(`  Users:          ${userCount}`);
  console.log(`  Accounts:       ${accountCount}`);
  console.log(`  Categories:     ${categoryCount}`);
  console.log(`  JournalEntries: ${journalEntryCount}`);
  console.log(`  JournalLines:   ${journalLineCount}`);
  console.log(`  AuditLogs:      ${auditLogCount}`);

  if (dryRun) {
    console.log("Dry run mode: no data was deleted.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Remove users first to satisfy FK constraint from User.companyId -> Company.id
    await tx.user.deleteMany({ where: { companyId: company.id } });

    // Deleting the company will cascade to accounts, journal entries, journal lines,
    // audit logs, and categories because of Prisma onDelete: Cascade rules.
    await tx.company.delete({ where: { id: company.id } });
  });

  console.log(
    `Permanently deleted company ${company.id} (${company.name}) and its related data.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const explicitIdArg = args.find((a) => !a.startsWith("--"));

  const where: any = { deletedAt: { not: null } };
  if (explicitIdArg) {
    where.id = explicitIdArg;
  }

  const companies = await prisma.company.findMany({
    where,
    select: { id: true },
  });

  if (companies.length === 0) {
    if (explicitIdArg) {
      console.log(
        `No soft-deleted company found with id ${explicitIdArg}. Nothing to purge.`,
      );
    } else {
      console.log("No soft-deleted companies found. Nothing to purge.");
    }
    return;
  }

  console.log(
    `Found ${companies.length} soft-deleted compan${
      companies.length === 1 ? "y" : "ies"
    } to purge.`,
  );

  for (const c of companies) {
    await purgeCompany(c.id, dryRun);
  }
}

main()
  .catch((e) => {
    console.error("Error while purging soft-deleted companies:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
