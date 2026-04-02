import { describe, expect, it } from "vitest";
import { buildAbsoluteUrl, getRequestOrigin, resolveSameOriginRedirect } from "@/lib/request-origin";

describe("request origin helpers", () => {
  it("prefers forwarded host and protocol", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-host": "192.168.1.50:3000",
        "x-forwarded-proto": "http",
        host: "localhost:3000"
      }
    });

    expect(getRequestOrigin(request)).toBe("http://192.168.1.50:3000");
    expect(buildAbsoluteUrl(request, "/bins/AB01")).toBe("http://192.168.1.50:3000/bins/AB01");
  });

  it("falls back to host when no forwarded headers are present", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        host: "localhost:3000"
      }
    });

    expect(getRequestOrigin(request)).toBe("http://localhost:3000");
  });

  it("falls back to configured base URL for invalid host headers", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        host: "bad host value"
      }
    });

    expect(getRequestOrigin(request)).toBe("http://localhost:3000");
  });

  it("keeps auth redirects on the current request origin", () => {
    expect(resolveSameOriginRedirect("/", "http://192.168.1.50:3000", "http://localhost:3000")).toBe(
      "http://192.168.1.50:3000/"
    );
    expect(
      resolveSameOriginRedirect(
        "http://192.168.1.50:3000/items/new",
        "http://192.168.1.50:3000",
        "http://localhost:3000"
      )
    ).toBe("http://192.168.1.50:3000/items/new");
    expect(
      resolveSameOriginRedirect("http://example.com/elsewhere", "http://192.168.1.50:3000", "http://localhost:3000")
    ).toBe("http://192.168.1.50:3000");
  });
});
