import { NextRequest, NextResponse } from "next/server";
import { ZodTypeAny } from "zod";

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function parsePagination(params: URLSearchParams, max = 200) {
  const limitRaw = Number(params.get("limit") || 50);
  const offsetRaw = Number(params.get("offset") || 0);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(max, Math.trunc(limitRaw))) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;
  return { limit, offset };
}

export async function parseJson<T>(req: NextRequest, schema: ZodTypeAny) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: badRequest("Invalid JSON body") } as const;
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: badRequest("Validation failed", parsed.error.flatten()) } as const;
  }

  return { data: parsed.data as T } as const;
}
