import { buildBackupPayload } from "@/lib/backup-payload";
import { createBackupZip } from "@/lib/backup";

async function main() {
  const payload = await buildBackupPayload({
    includeUsers: true,
    includeAuditLogs: true
  });
  const result = await createBackupZip(payload);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
