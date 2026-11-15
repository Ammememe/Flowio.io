import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { getVerifier } from "../auth/getVerifier.js";
import { createTranscriptionToken } from "../elevenlabs/createTranscriptionToken.js";
import { getElevenLabsApiKey } from "../elevenlabs/getApiKey.js";
import { logger } from "../logger.js";
import { getAuthHeader } from "./authHeader.js";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await getVerifier().verify(getAuthHeader(event));
    const apiKey = await getElevenLabsApiKey();
    const result = await createTranscriptionToken(auth, apiKey);
    return {
      statusCode: result.status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result.ok ? result.body : result),
    };
  } catch (err) {
    logger.error("createTranscriptionToken: unhandled error", { error: String(err) });
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
