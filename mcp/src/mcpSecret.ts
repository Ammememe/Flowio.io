import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

let cached: string | undefined;
const client = new SecretsManagerClient({});

/**
 * Stopgap auth for the deployed Lambda (`lambda.ts`), until P5-1 adds real
 * per-user sign-in. Every request must send this value as
 * `Authorization: Bearer <secret>` -- not OAuth, just enough to keep a
 * public write-capable endpoint from being wide open to the internet in the
 * meantime. Created out-of-band with the AWS CLI (see `infra/README.md`),
 * never through CDK, same reasoning as the ElevenLabs key
 * (`api/src/elevenlabs/getApiKey.ts`).
 */
export async function getMcpSharedSecret(): Promise<string | undefined> {
  if (cached) return cached;

  const secretName = process.env.MCP_SHARED_SECRET_NAME;
  if (!secretName) return undefined;

  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    cached = result.SecretString;
    return cached;
  } catch {
    return undefined;
  }
}
