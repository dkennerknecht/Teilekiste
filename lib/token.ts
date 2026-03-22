import { randomBytes, createHash } from "node:crypto";

export function generateApiToken() {
  return `tk_${randomBytes(24).toString("hex")}`;
}

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
