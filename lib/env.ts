export const env = {
  APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:3000",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "change-me",
  DATABASE_URL: process.env.DATABASE_URL || "file:/data/sqlite/app.db",
  UPLOAD_DIR: process.env.UPLOAD_DIR || "/data/uploads",
  ATTACHMENT_DIR: process.env.ATTACHMENT_DIR || "/data/attachments",
  BACKUP_DIR: process.env.BACKUP_DIR || "/data/backups",
  MAX_UPLOAD_SIZE_MB: Number(process.env.MAX_UPLOAD_SIZE_MB || 20)
};
