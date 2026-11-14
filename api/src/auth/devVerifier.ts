import type { AuthContext, Verifier } from "./types.js";

/**
 * Local-only stand-in for Cognito (P3-1), used by the local dev server and
 * tests. Accepts `Authorization: Bearer dev:<email>` and trusts it
 * outright -- there is no real Cognito deployed yet to check a token
 * against. `getVerifier.ts` refuses to use this outside local dev.
 */
export class DevVerifier implements Verifier {
  async verify(authHeader: string | undefined): Promise<AuthContext | null> {
    if (!authHeader?.startsWith("Bearer dev:")) return null;
    const email = authHeader.slice("Bearer dev:".length).trim();
    if (!email) return null;
    return { userId: `dev:${email}`, email };
  }
}
