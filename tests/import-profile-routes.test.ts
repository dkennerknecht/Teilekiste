import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const importProfileFindManyMock = vi.fn();
const importProfileFindFirstMock = vi.fn();
const importProfileFindUniqueMock = vi.fn();
const importProfileCreateMock = vi.fn();
const importProfileUpdateMock = vi.fn();
const importProfileDeleteMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importProfile: {
      findMany: importProfileFindManyMock,
      findFirst: importProfileFindFirstMock,
      findUnique: importProfileFindUniqueMock,
      create: importProfileCreateMock,
      update: importProfileUpdateMock,
      delete: importProfileDeleteMock
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("import profile routes", () => {
  it("returns hydrated profiles on GET", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    importProfileFindManyMock.mockResolvedValue([
      {
        id: "profile-1",
        name: "Supplier A",
        description: "CSV von Lieferant A",
        headerFingerprint: "name|typ|lagerort",
        delimiterMode: "SEMICOLON",
        mappingConfig: JSON.stringify({
          assignments: [{ targetKey: "name", sourceType: "column", column: "Artikelname", fixedValue: null }]
        })
      }
    ]);

    const { GET } = await import("@/app/api/admin/import-profiles/route");
    const response = await GET(new NextRequest("http://localhost/api/admin/import-profiles"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        id: "profile-1",
        delimiterMode: "SEMICOLON",
        mappingConfig: {
          assignments: [
            expect.objectContaining({
              targetKey: "name",
              sourceType: "column",
              column: "Artikelname"
            })
          ]
        }
      })
    ]);
  });

  it("creates a new profile with serialized mapping config", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    importProfileFindFirstMock.mockResolvedValue(null);
    importProfileCreateMock.mockResolvedValue({
      id: "profile-2",
      name: "Supplier B",
      description: null,
      headerFingerprint: "name|kategorie|lagerort",
      delimiterMode: "AUTO",
      mappingConfig: JSON.stringify({
        assignments: [{ targetKey: "category", sourceType: "fixed", fixedValue: "cat-1", column: null }]
      })
    });

    const { POST } = await import("@/app/api/admin/import-profiles/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/admin/import-profiles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Supplier B",
            description: null,
            headerFingerprint: "name|kategorie|lagerort",
            delimiterMode: "AUTO",
            mappingConfig: {
              assignments: [{ targetKey: "category", sourceType: "fixed", fixedValue: "cat-1" }]
            }
          })
        })
      )
    );

    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(201);
    expect(importProfileCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Supplier B",
          mappingConfig: expect.any(String)
        })
      })
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: "profile-2",
        mappingConfig: {
          assignments: [
            expect.objectContaining({
              targetKey: "category",
              sourceType: "fixed",
              fixedValue: "cat-1"
            })
          ]
        }
      })
    );
  });
});
