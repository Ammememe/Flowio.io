import { createServer } from "node:http";
import { MAX_IMAGE_BYTES } from "@flowio/shared";
import { DevVerifier } from "./auth/devVerifier.js";
import { createDeck, deleteDeck, getDeck, listDecks, updateDeck } from "./handlers.js";
import { logger } from "./logger.js";
import { MemoryDeckStore } from "./store/memoryStore.js";
import { createUploadUrl } from "./uploads/createUploadHandler.js";
import { LocalUploadPresigner } from "./uploads/localPresigner.js";

/**
 * Local stand-in for API Gateway + Lambda (P1-6, extended P3-1/P3-2), so
 * `web` has something to call during `pnpm dev` without a CDK deploy. Not
 * used in production -- the deployed API runs through `src/lambda/*.ts`
 * against DynamoDB and real Cognito.
 *
 * Auth here is always the dev stand-in (`Authorization: Bearer dev:<email>`,
 * see `src/auth/devVerifier.ts`) -- there's nothing to sign in against
 * locally until Cognito is deployed.
 */

const PORT = Number(process.env.PORT ?? 8787);
const store = new MemoryDeckStore();
const verifier = new DevVerifier();
const presigner = new LocalUploadPresigner(`http://localhost:${PORT}`);

function withCors(res: import("node:http").ServerResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
}

async function readRawBody(req: import("node:http").IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const text = (await readRawBody(req)).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

const server = createServer(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const auth = await verifier.verify(req.headers.authorization);

  function send(status: number, body: unknown): void {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body === null ? "" : JSON.stringify(body));
  }

  try {
    if (req.method === "POST" && url.pathname === "/decks") {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        send(400, { error: "Invalid JSON body" });
        return;
      }
      const result = await createDeck(store, auth, body);
      send(result.status, result.ok ? result.body : result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/decks") {
      const result = await listDecks(store, auth);
      send(result.status, result.ok ? result.body : result);
      return;
    }

    const idMatch = url.pathname.match(/^\/decks\/([^/]+)$/);
    if (req.method === "GET" && idMatch) {
      const result = await getDeck(store, auth, idMatch[1]);
      send(result.status, result.ok ? result.body : result);
      return;
    }
    if (req.method === "PATCH" && idMatch) {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        send(400, { error: "Invalid JSON body" });
        return;
      }
      const result = await updateDeck(store, auth, idMatch[1], body);
      send(result.status, result.ok ? result.body : result);
      return;
    }
    if (req.method === "DELETE" && idMatch) {
      const result = await deleteDeck(store, auth, idMatch[1]);
      send(result.status, result.ok ? result.body : result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/uploads") {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        send(400, { error: "Invalid JSON body" });
        return;
      }
      const result = await createUploadUrl(presigner, auth, body);
      send(result.status, result.ok ? result.body : result);
      return;
    }

    // Stand-in for S3: the presigned "upload" is just a PUT straight to this
    // server, and the file is served right back from the same path.
    const rawMatch = url.pathname.match(/^\/uploads\/raw\/(.+)$/);
    if (req.method === "PUT" && rawMatch) {
      const key = decodeURIComponent(rawMatch[1]);
      const contentType = req.headers["content-type"] ?? "application/octet-stream";
      const data = await readRawBody(req);
      if (data.byteLength > MAX_IMAGE_BYTES) {
        send(400, { error: `File too large: max ${MAX_IMAGE_BYTES} bytes` });
        return;
      }
      presigner.store.set(key, { contentType, data });
      send(204, null);
      return;
    }
    if (req.method === "GET" && rawMatch) {
      const key = decodeURIComponent(rawMatch[1]);
      const file = presigner.store.get(key);
      if (!file) {
        send(404, { error: "Not found" });
        return;
      }
      res.writeHead(200, { "content-type": file.contentType });
      res.end(file.data);
      return;
    }

    send(404, { error: "Not found" });
  } catch (err) {
    logger.error("local api: unhandled error", { error: String(err) });
    send(500, { error: "Internal error" });
  }
});

server.listen(PORT, () => {
  logger.info("local api listening", { port: PORT });
});
