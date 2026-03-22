import { createServer, type IncomingMessage } from "node:http";
import { NextRequest } from "next/server";

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return undefined;
  return Buffer.concat(chunks);
}

export function createRouteServer(
  handler: (req: NextRequest) => Promise<Response>
) {
  return createServer(async (req, res) => {
    try {
      const url = `http://localhost${req.url || "/"}`;
      const body = req.method && ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);

      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: body as BodyInit | undefined
      });

      const nextRequest = new NextRequest(request);
      const response = await handler(nextRequest);
      const headers = Object.fromEntries(response.headers.entries());
      res.writeHead(response.status, headers);
      const data = Buffer.from(await response.arrayBuffer());
      res.end(data);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: String(error) }));
    }
  });
}
