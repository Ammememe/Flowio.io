import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { directBackend } from "./directBackend.js";
import { getMcpSharedSecret } from "./mcpSecret.js";
import { registerDeckTools } from "./tools.js";

/**
 * Deployed entry point (P5-2): a public Streamable HTTP endpoint behind API
 * Gateway. Stateless by design -- `sessionIdGenerator: undefined` plus a
 * fresh `McpServer`/transport per invocation -- which is what makes this
 * work as an ordinary (non-streaming-response) Lambda: no state has to
 * survive between one request and the next, so any warm or cold container
 * can handle any request. `enableJsonResponse: true` answers each call with
 * one JSON object instead of opening an SSE stream, which Lambda's
 * buffered-response model can't do anyway.
 *
 * Gated by a shared secret (`mcpSecret.ts`), not OAuth -- P5-1 is deferred
 * on purpose. See `directBackend.ts` for why decks are written straight to
 * DynamoDB rather than through the Cognito-gated HTTP API.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const expectedSecret = await getMcpSharedSecret();
  if (!expectedSecret) {
    return jsonResult(500, { error: "MCP server is not configured: no shared secret available" });
  }
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return jsonResult(401, { error: "Unauthorized" });
  }

  const server = new McpServer({ name: "flowio", version: "0.0.1" });
  registerDeckTools(server, directBackend);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const response = await transport.handleRequest(toWebRequest(event));
  return toApiGatewayResult(response);
}

function jsonResult(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

function toWebRequest(event: APIGatewayProxyEventV2): Request {
  const host = event.headers?.host ?? event.requestContext.domainName ?? "lambda.local";
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = new URL(`${event.rawPath}${query}`, `https://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(key, value);
  }

  const method = event.requestContext.http.method;
  const hasBody = method !== "GET" && method !== "HEAD" && event.body !== undefined;
  const body = hasBody ? (event.isBase64Encoded ? Buffer.from(event.body!, "base64") : event.body) : undefined;

  return new Request(url, { method, headers, body });
}

async function toApiGatewayResult(response: Response): Promise<APIGatewayProxyResultV2> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = await response.text();
  return { statusCode: response.status, headers, body };
}
