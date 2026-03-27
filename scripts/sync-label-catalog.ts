import { PrismaClient } from "@prisma/client";
import { syncLabelCatalog } from "@/lib/label-catalog";

const prisma = new PrismaClient();

async function main() {
  await syncLabelCatalog(prisma);
  console.log("Label-Katalog synchronisiert.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
