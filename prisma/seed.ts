import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "@/prisma/seed-data";

const prisma = new PrismaClient();

async function main() {
  const result = await seedDatabase(prisma);
  console.log(
    `Seed completed. Admin login: ${result.adminEmail} / admin123. Sample items: ${result.sampleItemCodes.join(", ")}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
