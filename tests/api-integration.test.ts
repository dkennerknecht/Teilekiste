import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRouteServer } from "@/tests/route-server";

const requireAuthMock = vi.fn();
const findManyMock = vi.fn();
const previewLabelCodeMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: findManyMock
    }
  }
}));

vi.mock("@/lib/label-code", () => ({
  previewLabelCode: previewLabelCodeMock
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("API Integration", () => {
  it("GET /api/items/duplicates returns duplicate candidates", async () => {
    requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "admin@local" } });
    findManyMock.mockResolvedValue([
      { id: "1", labelCode: "EL-KB-023", name: "ESP32 DevKit V1" },
      { id: "2", labelCode: "EL-KB-024", name: "ESP32 S3" }
    ]);

    const { GET } = await import("@/app/api/items/duplicates/route");
    const server = createRouteServer(GET);
    try {
      const res = await request(server).get("/api/items/duplicates?name=ESP32");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(findManyMock).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("GET /api/items/duplicates with no query returns empty list", async () => {
    requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "admin@local" } });

    const { GET } = await import("@/app/api/items/duplicates/route");
    const server = createRouteServer(GET);
    try {
      const res = await request(server).get("/api/items/duplicates");

      expect(res.status).toBe(200);
      expect(res.text).toBe("[]");
      expect(findManyMock).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("GET /api/label/preview returns generated preview", async () => {
    requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "admin@local" } });
    previewLabelCodeMock.mockResolvedValue("EL-KB-120");

    const { GET } = await import("@/app/api/label/preview/route");
    const server = createRouteServer(GET);
    try {
      const res = await request(server).get("/api/label/preview?areaId=a1&typeId=t1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ preview: "EL-KB-120" });
      expect(previewLabelCodeMock).toHaveBeenCalledWith("a1", "t1");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
