import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@local",
      passwordHash,
      role: "ADMIN"
    }
  });

  const categories = await Promise.all(
    ["Mikrocontroller", "Passiv", "Schutz", "Kabel", "Werkzeug"].map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );

  const locations = await Promise.all(
    [
      { name: "Werkstatt", code: "WERK" },
      { name: "Keller", code: "KELL" },
      { name: "Buero", code: "BUER" }
    ].map((entry) =>
      prisma.storageLocation.upsert({
        where: { name: entry.name },
        update: {},
        create: entry
      })
    )
  );

  const tagNames = ["SMD", "THT", "Sicherung", "ESP32", "Netzwerk", "3D-Druck"];
  await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );

  const areaEL = await prisma.area.upsert({
    where: { code: "EL" },
    update: {},
    create: { code: "EL", name: "Elektronik" }
  });

  const areaNW = await prisma.area.upsert({
    where: { code: "NW" },
    update: {},
    create: { code: "NW", name: "Netzwerk" }
  });

  const typeKB = await prisma.labelType.upsert({
    where: { areaId_code: { areaId: areaEL.id, code: "KB" } },
    update: {},
    create: { areaId: areaEL.id, code: "KB", name: "Kleinbauteil" }
  });

  const typeSW = await prisma.labelType.upsert({
    where: { areaId_code: { areaId: areaNW.id, code: "SW" } },
    update: {},
    create: { areaId: areaNW.id, code: "SW", name: "Switch" }
  });

  await prisma.sequenceCounter.upsert({
    where: { areaId_typeId: { areaId: areaEL.id, typeId: typeKB.id } },
    update: {},
    create: { areaId: areaEL.id, typeId: typeKB.id, nextNumber: 24 }
  });

  await prisma.sequenceCounter.upsert({
    where: { areaId_typeId: { areaId: areaNW.id, typeId: typeSW.id } },
    update: {},
    create: { areaId: areaNW.id, typeId: typeSW.id, nextNumber: 105 }
  });

  await prisma.labelConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", separator: "-", digits: 3, delimiter: "," }
  });

  const voltageField = await prisma.customField.upsert({
    where: { key: "spannung" },
    update: {},
    create: {
      name: "Spannung",
      key: "spannung",
      type: "NUMBER",
      options: JSON.stringify({ unit: "V" }),
      required: false
    }
  });

  const toleranceField = await prisma.customField.upsert({
    where: { key: "toleranz" },
    update: {},
    create: {
      name: "Toleranz",
      key: "toleranz",
      type: "SELECT",
      options: JSON.stringify(["1%", "5%", "10%"]),
      required: false
    }
  });

  const esp32 = await prisma.item.upsert({
    where: { labelCode: "EL-KB-023" },
    update: {},
    create: {
      labelCode: "EL-KB-023",
      name: "ESP32 DevKit V1",
      description: "WLAN/Bluetooth Board",
      categoryId: categories[0].id,
      storageLocationId: locations[0].id,
      storageArea: "Regal 1",
      bin: "A12",
      stock: 18,
      unit: "STK",
      minStock: 5,
      manufacturer: "Espressif",
      mpn: "ESP32-DEVKIT-V1",
      datasheetUrl: "https://www.espressif.com",
      purchaseUrl: "https://example.com/esp32"
    }
  });

  const switchItem = await prisma.item.upsert({
    where: { labelCode: "NW-SW-104" },
    update: {},
    create: {
      labelCode: "NW-SW-104",
      name: "8-Port Gigabit Switch",
      description: "Unmanaged",
      categoryId: categories[4].id,
      storageLocationId: locations[2].id,
      storageArea: "Schrank Netz",
      bin: "B02",
      stock: 4,
      unit: "STK",
      minStock: 2,
      manufacturer: "TP-Link",
      mpn: "TL-SG108"
    }
  });

  await prisma.itemCustomFieldValue.upsert({
    where: { itemId_customFieldId: { itemId: esp32.id, customFieldId: voltageField.id } },
    update: { valueJson: JSON.stringify(3.3) },
    create: { itemId: esp32.id, customFieldId: voltageField.id, valueJson: JSON.stringify(3.3) }
  });

  await prisma.itemCustomFieldValue.upsert({
    where: { itemId_customFieldId: { itemId: esp32.id, customFieldId: toleranceField.id } },
    update: { valueJson: JSON.stringify("5%") },
    create: { itemId: esp32.id, customFieldId: toleranceField.id, valueJson: JSON.stringify("5%") }
  });

  await prisma.stockMovement.create({
    data: {
      itemId: esp32.id,
      delta: 20,
      reason: "PURCHASE",
      note: "Erstbestand",
      userId: admin.id
    }
  });

  await prisma.stockMovement.create({
    data: {
      itemId: esp32.id,
      delta: -2,
      reason: "CONSUMPTION",
      note: "Prototyp A",
      userId: admin.id
    }
  });

  await prisma.reservation.create({
    data: {
      itemId: esp32.id,
      reservedQty: 3,
      reservedFor: "Projekt Wetterstation",
      note: "Sprint 2",
      userId: admin.id
    }
  });

  await prisma.attachment.create({
    data: {
      itemId: esp32.id,
      path: "/data/attachments/esp32-datasheet.pdf",
      mime: "application/pdf",
      size: 1200,
      kind: "PDF"
    }
  });

  console.log(`Seed completed. Admin login: admin@local / admin123. Sample items: ${esp32.labelCode}, ${switchItem.labelCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
