import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSessionTokenPayloadFromCookieStore,
  getSessionTokenPayloadFromRequest,
  INSECURE_AUTH_SESSION_COOKIE,
  SECURE_AUTH_SESSION_COOKIE,
  resetSessionTokenDecoderForTests,
  setSessionTokenDecoderForTests
} from "@/lib/auth-token";

describe("auth token helpers", () => {
  afterEach(() => {
    resetSessionTokenDecoderForTests();
  });

  it("prefers the secure session cookie when it exists", async () => {
    const decodeMock = vi.fn().mockResolvedValue({ sub: "user-1", role: "ADMIN" });
    setSessionTokenDecoderForTests(decodeMock);

    const result = await getSessionTokenPayloadFromRequest({
      headers: new Headers(),
      cookies: {
        getAll: () => [{ name: SECURE_AUTH_SESSION_COOKIE, value: "secure-token" }]
      }
    });

    expect(result).toEqual({ sub: "user-1", role: "ADMIN" });
    expect(decodeMock).toHaveBeenCalledTimes(1);
    expect(decodeMock.mock.calls[0]?.[0]).toMatchObject({
      token: "secure-token"
    });
  });

  it("falls back to the non-secure cookie name when needed", async () => {
    const decodeMock = vi.fn().mockResolvedValue({ sub: "user-2", role: "READ" });
    setSessionTokenDecoderForTests(decodeMock);

    const result = await getSessionTokenPayloadFromCookieStore({
      getAll: () => [
        { name: INSECURE_AUTH_SESSION_COOKIE, value: "token" }
      ]
    });

    expect(result).toEqual({ sub: "user-2", role: "READ" });
    expect(decodeMock).toHaveBeenCalledTimes(1);
    expect(decodeMock.mock.calls[0]?.[0]).toMatchObject({
      token: "token"
    });
  });
});
