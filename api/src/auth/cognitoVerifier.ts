import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { AuthContext, Verifier } from "./types.js";

/**
 * P3-1: verifies a real Cognito access token (ID token) against the user
 * pool's JWKS -- no network call per request, the JWKS is cached and
 * re-fetched only when a `kid` it hasn't seen shows up.
 */
export class CognitoVerifier implements Verifier {
  private readonly jwtVerifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor(userPoolId: string, clientId: string) {
    this.jwtVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "id",
      clientId,
    });
  }

  async verify(authHeader: string | undefined): Promise<AuthContext | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length).trim();
    try {
      const payload = await this.jwtVerifier.verify(token);
      return { userId: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
    } catch {
      return null;
    }
  }
}
