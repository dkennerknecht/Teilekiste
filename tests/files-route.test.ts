import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const readFileMock = vi.fn();
const realpathMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock
}));

vi.mock("@/lib/env", () => ({
  env: {
    UPLOAD_DIR: "/data/uploads",
    ATTACHMENT_DIR: "/data/attachments"
  }
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: readFileMock,
    realpath: realpathMock
  }
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("Files route", () => {
  it("rejects paths outside allowed roots before touching the filesystem", async () => {
    requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "admin@local" } });

    const { GET } = await import("@/app/api/files/[...path]/route");
    const res = await GET(
      new NextRequest(new Request("http://localhost/api/files/data/uploads-archive/secrets.txt")),
      { params: { path: ["data", "uploads-archive", "secrets.txt"] } }
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(realpathMock).not.toHaveBeenCalled();
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("rejects symlink escapes after resolving the real file path", async () => {
    requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "admin@local" } });
    realpathMock.mockImplementation(async (input: string) => {
      if (input === "/data/uploads/item-1/linked-secret.txt") return "/etc/passwd";
      return input;
    });

    const { GET } = await import("@/app/api/files/[...path]/route");
    const res = await GET(
      new NextRequest(new Request("http://localhost/api/files/data/uploads/item-1/linked-secret.txt")),
      { params: { path: ["data", "uploads", "item-1", "linked-secret.txt"] } }
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("serves files that stay within an allowed root after resolution", async () => {
    requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "admin@local" } });
    realpathMock.mockImplementation(async (input: string) => input);
    readFileMock.mockResolvedValue(Buffer.from("ok"));

    const { GET } = await import("@/app/api/files/[...path]/route");
    const res = await GET(
      new NextRequest(new Request("http://localhost/api/files/data/uploads/item-1/photo.jpg")),
      { params: { path: ["data", "uploads", "item-1", "photo.jpg"] } }
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(readFileMock).toHaveBeenCalledWith("/data/uploads/item-1/photo.jpg");
  });
});
