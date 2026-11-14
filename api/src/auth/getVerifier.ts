import { CognitoVerifier } from "./cognitoVerifier.js";
import { DevVerifier } from "./devVerifier.js";
import type { Verifier } from "./types.js";

let cached: Verifier | undefined;

/**
 * Picks the real verifier when the deployed Cognito user pool's env vars
 * are present, otherwise the dev stand-in -- but only when explicitly
 * allowed, so a misconfigured deploy fails loudly instead of silently
 * trusting `Bearer dev:*` tokens.
 */
export function getVerifier(): Verifier {
  if (cached) return cached;

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (userPoolId && clientId) {
    cached = new CognitoVerifier(userPoolId, clientId);
    return cached;
  }

  if (process.env.ALLOW_DEV_AUTH === "true") {
    cached = new DevVerifier();
    return cached;
  }

  throw new Error(
    "No auth configured: set COGNITO_USER_POOL_ID + COGNITO_CLIENT_ID, or ALLOW_DEV_AUTH=true for local dev only.",
  );
}
