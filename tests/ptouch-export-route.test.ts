import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const storageBinFindManyMock = vi.fn();
const storageShelfFindManyMock = vi.fn();
const itemFindManyMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/csv", () => ({
  toCsv(rows: Array<Record<string, unknown>>, delimiter = ",") {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(delimiter)];
    for (const row of rows) {
      lines.push(headers.map((header) => String(row[header] ?? "")).join(delimiter));
    }
    return lines.join("\n");
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storageBin: {
      findMany: storageBinFindManyMock
    },
    storageShelf: {
      findMany: storageShelfFindManyMock
    },
    item: {
      findMany: itemFindManyMock
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("ptouch export route", () => {
  it("exports all shelf and drawer labels with generic columns", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageBinFindManyMock.mockResolvedValue([
      {
        id: "bin-1",
        code: "02",
        storageShelf: { id: "shelf-1", code: "AB" }
      }
    ]);
    storageShelfFindManyMock.mockResolvedValue([
      {
        id: "shelf-1",
        code: "AB",
        name: "Automaten"
      }
    ]);

    const { GET } = await import("@/app/api/export/ptouch/route");
    const response = await GET(new NextRequest(new Request("http://localhost:3000/api/export/ptouch?mode=all")));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("ptouch-all-labels.csv");
    expect(body).toContain("labelUrl;labelName");
    expect(body).toContain("http://localhost:3000/shelves/shelf-1;AB");
    expect(body).toContain("http://localhost:3000/bins/AB02;AB02");
  });

  it("exports only shelf labels", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageBinFindManyMock.mockResolvedValue([]);
    storageShelfFindManyMock.mockResolvedValue([
      {
        id: "shelf-1",
        code: "CA",
        name: "Sicherungen"
      }
    ]);

    const { GET } = await import("@/app/api/export/ptouch/route");
    const response = await GET(new NextRequest(new Request("http://localhost:3000/api/export/ptouch?mode=shelves")));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("ptouch-shelves.csv");
    expect(body).toContain("labelUrl;labelName");
    expect(body).toContain("http://localhost:3000/shelves/shelf-1;CA");
    expect(body).not.toContain("/bins/");
  });

  it("exports only drawer labels", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageBinFindManyMock.mockResolvedValue([
      {
        id: "bin-1",
        code: "99",
        storageShelf: { id: "shelf-1", code: "CB" }
      }
    ]);
    storageShelfFindManyMock.mockResolvedValue([]);

    const { GET } = await import("@/app/api/export/ptouch/route");
    const response = await GET(new NextRequest(new Request("http://localhost:3000/api/export/ptouch?mode=drawers")));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("ptouch-drawers.csv");
    expect(body).toContain("labelUrl;labelName");
    expect(body).toContain("http://localhost:3000/bins/CB99;CB99");
    expect(body).not.toContain("/shelves/");
  });

  it("supports common delimiters only and uses comma when requested", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageBinFindManyMock.mockResolvedValue([]);
    storageShelfFindManyMock.mockResolvedValue([
      {
        id: "shelf-1",
        code: "AA",
        name: "Automaten"
      }
    ]);

    const { GET } = await import("@/app/api/export/ptouch/route");
    const response = await GET(new NextRequest(new Request("http://localhost:3000/api/export/ptouch?mode=shelves&delimiter=comma")));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("labelUrl,labelName");
    expect(body).toContain("http://localhost:3000/shelves/shelf-1,AA");
    expect(body).not.toContain("labelUrl;labelName");
  });

  it("uses the current LAN host for exported links", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageBinFindManyMock.mockResolvedValue([
      {
        id: "bin-1",
        code: "02",
        storageShelf: { id: "shelf-1", code: "AB" }
      }
    ]);
    storageShelfFindManyMock.mockResolvedValue([]);

    const { GET } = await import("@/app/api/export/ptouch/route");
    const response = await GET(
      new NextRequest(
        new Request("http://127.0.0.1/api/export/ptouch?mode=drawers", {
          headers: {
            "x-forwarded-host": "192.168.1.50:3000",
            "x-forwarded-proto": "http"
          }
        })
      )
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("http://192.168.1.50:3000/bins/AB02;AB02");
  });
});
