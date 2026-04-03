import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: updateMock,
      findMany: vi.fn(),
      create: vi.fn()
    },
    userLocation: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("admin users route", () => {
  it("updates the password hash when a new password is provided", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    updateMock.mockImplementation(async ({ data }) => ({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Admin",
      email: "admin@local",
      role: "ADMIN",
      isActive: true,
      passwordHash: data.passwordHash
    }));

    const { PATCH } = await import("@/app/api/admin/users/route");
    const response = await PATCH(
      new NextRequest(
        new Request("http://localhost/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "11111111-1111-4111-8111-111111111111",
            password: "new-secure-password",
            name: "Admin",
            email: "admin@local",
            role: "ADMIN",
            isActive: true
          })
        })
      )
    );

    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();

    const updateArgs = updateMock.mock.calls[0]?.[0];
    expect(updateArgs?.data.passwordHash).toBeTruthy();
    expect(await bcrypt.compare("new-secure-password", updateArgs.data.passwordHash)).toBe(true);
  });
});
