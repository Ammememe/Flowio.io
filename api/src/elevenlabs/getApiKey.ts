import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

let cached: string | undefined;
const client = new SecretsManagerClient({});

/**
 * P4-1: resolves the ElevenLabs API key. Local dev reads it straight from
 * `.env` (ELEVENLABS_API_KEY) for simplicity; the deployed Lambda instead
 * reads ELEVENLABS_SECRET_NAME and fetches the value from Secrets Manager,
 * so the real key never sits in a Lambda env var (visible to anyone with
 * `lambda:GetFunctionConfiguration`) or a CloudFormation template -- only
 * this function's execution role can read it, via a scoped IAM grant
 * (infra/lib/api-stack.ts). The secret itself is created out-of-band with
 * the AWS CLI, never through CDK, so the real value never touches a
 * synthesized template either (see infra/README.md).
 *
 * Cached per execution environment: Secrets Manager is called at most once
 * per Lambda cold start, not once per request.
 */
export async function getElevenLabsApiKey(): Promise<string | undefined> {
  if (cached) return cached;

  if (process.env.ELEVENLABS_API_KEY) {
    cached = process.env.ELEVENLABS_API_KEY;
    return cached;
  }

  const secretName = process.env.ELEVENLABS_SECRET_NAME;
  if (!secretName) return undefined;

  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    cached = result.SecretString;
    return cached;
  } catch {
    // Secret doesn't exist yet (e.g. a fresh stage before anyone has run
    // the one-time `aws secretsmanager create-secret` step) -- degrade the
    // same way as "not configured" rather than a scary 500.
    return undefined;
  }
}
