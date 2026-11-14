import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { getVerifier } from "../auth/getVerifier.js";
import { listDecks } from "../handlers.js";
import { logger } from "../logger.js";
import { DynamoDeckStore } from "../store/dynamoStore.js";
import { getAuthHeader } from "./authHeader.js";

const store = new DynamoDeckStore(requireEnv("DECKS_TABLE_NAME"));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await getVerifier().verify(getAuthHeader(event));
    const result = await listDecks(store, auth);
    return {
      statusCode: result.status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result.ok ? result.body : result),
    };
  } catch (err) {
    logger.error("listDecks: unhandled error", { error: String(err) });
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
