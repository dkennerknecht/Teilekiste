import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

type HeaderSource =
  | Headers
  | Pick<NextRequest, "headers">
  | Record<string, string | string[] | undefined | null>;

function readHeader(headers: HeaderSource, name: string) {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }

  const raw = (headers as Record<string, string | string[] | undefined | null>)[name]
    ?? (headers as Record<string, string | string[] | undefined | null>)[name.toLowerCase()];

  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function firstForwardedValue(value: string | null | undefined) {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function normalizeProtocol(value: string | null | undefined) {
  const normalized = firstForwardedValue(value)?.toLowerCase();
  return normalized === "http" || normalized === "https" ? normalized : null;
}

function resolveFallbackOrigin() {
  const candidates = [env.APP_BASE_URL, env.NEXTAUTH_URL, "http://localhost:3000"];
  for (const candidate of candidates) {
    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }
  return "http://localhost:3000";
}

function inferProtocolFromRequest(request?: Pick<NextRequest, "nextUrl" | "url"> | Request) {
  if (request && "nextUrl" in request && request.nextUrl?.protocol) {
    return request.nextUrl.protocol === "http:" ? "http" : request.nextUrl.protocol === "https:" ? "https" : null;
  }

  if (!request?.url) return null;

  try {
    const url = new URL(request.url);
    return url.protocol === "http:" ? "http" : url.protocol === "https:" ? "https" : null;
  } catch {
    return null;
  }
}

export function getRequestOrigin(request: Pick<NextRequest, "headers" | "nextUrl" | "url"> | Request) {
  const forwardedHost = firstForwardedValue(readHeader(request.headers, "x-forwarded-host"));
  const host = firstForwardedValue(readHeader(request.headers, "host"));
  const protocol =
    normalizeProtocol(readHeader(request.headers, "x-forwarded-proto")) || inferProtocolFromRequest(request) || "http";
  const selectedHost = forwardedHost || host;

  if (selectedHost) {
    try {
      return new URL(`${protocol}://${selectedHost}`).origin;
    } catch {
      return resolveFallbackOrigin();
    }
  }

  return resolveFallbackOrigin();
}

export function buildAbsoluteUrl(
  request: Pick<NextRequest, "headers" | "nextUrl" | "url"> | Request,
  pathname: string
) {
  return new URL(pathname, `${getRequestOrigin(request)}/`).toString();
}

export function resolveSameOriginRedirect(url: string, requestOrigin: string, fallbackOrigin?: string) {
  const baseOrigin = requestOrigin || fallbackOrigin || resolveFallbackOrigin();

  if (url.startsWith("/")) {
    return new URL(url, `${requestOrigin}/`).toString();
  }

  try {
    const target = new URL(url);
    return target.origin === requestOrigin ? target.toString() : baseOrigin;
  } catch {
    return baseOrigin;
  }
}
