import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

const { decode } = require("next-auth/jwt") as {
  decode: (params: { token: string; secret: string }) => Promise<Record<string, unknown> | null>;
};

let sessionTokenDecoder = decode;

export const SECURE_AUTH_SESSION_COOKIE = "__Secure-next-auth.session-token";
export const INSECURE_AUTH_SESSION_COOKIE = "next-auth.session-token";

export type SessionTokenPayload = {
  sub?: string;
  email?: string;
  role?: string;
} & Record<string, unknown>;

type CookieEntry = { name: string; value: string };
type CookieStoreLike = { getAll(): CookieEntry[] };
type RequestLike =
  | Pick<NextRequest, "headers" | "cookies">
  | {
      headers: Headers | Record<string, string | undefined>;
      cookies: CookieStoreLike | Map<string, string> | Record<string, string>;
    };

function listCookieEntries(cookies: RequestLike["cookies"]) {
  if (typeof (cookies as CookieStoreLike).getAll === "function") {
    return (cookies as CookieStoreLike).getAll();
  }

  if (cookies instanceof Map) {
    return Array.from(cookies.entries()).map(([name, value]) => ({
      name,
      value
    }));
  }

  return Object.entries(cookies).map(([name, value]) => ({
    name,
    value
  }));
}

function readChunkedCookieValue(cookies: RequestLike["cookies"], cookieName: string) {
  const chunks = listCookieEntries(cookies)
    .filter((entry) => entry.name === cookieName || entry.name.startsWith(`${cookieName}.`))
    .sort((left, right) => {
      const leftSuffix = Number.parseInt(left.name.split(".").pop() ?? "0", 10);
      const rightSuffix = Number.parseInt(right.name.split(".").pop() ?? "0", 10);
      return leftSuffix - rightSuffix;
    });

  if (chunks.length === 0) return null;
  return chunks.map((entry) => entry.value).join("");
}

async function readTokenFromCookie(request: RequestLike, cookieName: string): Promise<SessionTokenPayload | null> {
  const encodedToken = readChunkedCookieValue(request.cookies, cookieName);
  if (!encodedToken) return null;

  const decodedToken = await sessionTokenDecoder({
    token: encodedToken,
    secret: env.NEXTAUTH_SECRET
  });

  return decodedToken as SessionTokenPayload | null;
}

export async function getSessionTokenPayloadFromRequest(request: RequestLike): Promise<SessionTokenPayload | null> {
  return (
    (await readTokenFromCookie(request, SECURE_AUTH_SESSION_COOKIE))
    || (await readTokenFromCookie(request, INSECURE_AUTH_SESSION_COOKIE))
  );
}

export async function getSessionTokenPayloadFromCookieStore(cookieStore: CookieStoreLike): Promise<SessionTokenPayload | null> {
  return getSessionTokenPayloadFromRequest({
    headers: new Headers(),
    cookies: cookieStore
  });
}

export function setSessionTokenDecoderForTests(
  decoder: (params: { token: string; secret: string }) => Promise<Record<string, unknown> | null>
) {
  sessionTokenDecoder = decoder;
}

export function resetSessionTokenDecoderForTests() {
  sessionTokenDecoder = decode;
}
