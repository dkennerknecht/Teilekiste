import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "@/prisma/seed-data";

const root = process.cwd();
const dbPath = path.join(root, "prisma", "playwright.db");
const migrationsDir = path.join(root, "prisma", "migrations");

async function main() {
  await fs.rm(dbPath, { force: true });

  const migrationDirs = (await fs.readdir(migrationsDir))
    .filter((entry) => entry !== "migration_lock.toml")
    .sort();

  for (const dir of migrationDirs) {
    const sqlPath = path.join(migrationsDir, dir, "migration.sql");
    const sql = await fs.readFile(sqlPath, "utf8");
    execFileSync("sqlite3", [dbPath], { input: sql });
  }

  process.env.DATABASE_URL = `file:${dbPath}`;
  const prisma = new PrismaClient();
  try {
    await seedDatabase(prisma as never);
    console.log(`Prepared Playwright DB at ${dbPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
