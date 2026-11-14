import { createServer } from "node:http";
import { createDeck, getDeck } from "./handlers.js";
import { logger } from "./logger.js";
import { MemoryDeckStore } from "./store/memoryStore.js";

/**
 * Local stand-in for API Gateway + Lambda (P1-6), so `web` has something to
 * call during `pnpm dev` without a CDK deploy. Not used in production --
 * the deployed API runs through `src/lambda/*.ts` against DynamoDB.
 */

const PORT = Number(process.env.PORT ?? 8787);
const store = new MemoryDeckStore();

function withCors(res: import("node:http").ServerResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

const server = createServer(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/decks") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }
    const result = await createDeck(store, body);
    res.writeHead(result.status, { "content-type": "application/json" });
    res.end(JSON.stringify(result.ok ? result.body : result));
    return;
  }

  const getMatch = url.pathname.match(/^\/decks\/([^/]+)$/);
  if (req.method === "GET" && getMatch) {
    const result = await getDeck(store, getMatch[1]);
    res.writeHead(result.status, { "content-type": "application/json" });
    res.end(JSON.stringify(result.ok ? result.body : result));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  logger.info("local api listening", { port: PORT });
});
