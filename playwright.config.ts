import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

function readDotEnvValue(key: string) {
  try {
    const envText = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const match = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
    return match?.[1]?.replace(/^['"]|['"]$/g, "").trim();
  } catch {
    return "";
  }
}

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXTAUTH_URL ||
  process.env.APP_BASE_URL ||
  readDotEnvValue("NEXTAUTH_URL") ||
  readDotEnvValue("APP_BASE_URL") ||
  "http://127.0.0.1:3000";
const databaseURL = process.env.DATABASE_URL || `file:${path.join(process.cwd(), "prisma", "playwright.db")}`;
const parsedBaseUrl = new URL(baseURL);
const webServerHost = parsedBaseUrl.hostname || "localhost";
const webServerPort = parsedBaseUrl.port || (parsedBaseUrl.protocol === "https:" ? "443" : "3000");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `npm run dev -- --hostname ${webServerHost} --port ${webServerPort}`,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          APP_BASE_URL: baseURL,
          NEXTAUTH_URL: baseURL,
          NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "playwright-secret",
          DATABASE_URL: databaseURL,
          RUN_SEED_ON_STARTUP: "0"
        }
      }
});
