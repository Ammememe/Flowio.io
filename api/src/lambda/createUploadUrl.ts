import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { getVerifier } from "../auth/getVerifier.js";
import { logger } from "../logger.js";
import { createUploadUrl } from "../uploads/createUploadHandler.js";
import { S3UploadPresigner } from "../uploads/s3Presigner.js";
import { getAuthHeader } from "./authHeader.js";

const presigner = new S3UploadPresigner(requireEnv("MEDIA_BUCKET_NAME"), requireEnv("MEDIA_BASE_URL"));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  let body: unknown;
  try {
    body = event.body ? JSON.parse(event.body) : undefined;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  try {
    const auth = await getVerifier().verify(getAuthHeader(event));
    const result = await createUploadUrl(presigner, auth, body);
    return {
      statusCode: result.status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result.ok ? result.body : result),
    };
  } catch (err) {
    logger.error("createUploadUrl: unhandled error", { error: String(err) });
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
