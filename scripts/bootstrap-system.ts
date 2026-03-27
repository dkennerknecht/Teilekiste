import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { syncLabelCatalog } from "@/lib/label-catalog";

const prisma = new PrismaClient();

async function main() {
  await syncLabelCatalog(prisma);

  await prisma.labelConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@local",
      passwordHash,
      role: "ADMIN",
      isActive: true
    }
  });

  await prisma.storageLocation.upsert({
    where: { name: "Standardlager" },
    update: {},
    create: {
      name: "Standardlager",
      code: "MAIN"
    }
  });

  console.log("System-Bootstrap abgeschlossen. Login: admin@local / admin123. Default-Lagerort: Standardlager");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
