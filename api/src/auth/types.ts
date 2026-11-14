/** Identity extracted from a verified request (P3-1). `userId` is the Cognito `sub`. */
export interface AuthContext {
  userId: string;
  email?: string;
}

/** Verifies an `Authorization` header and returns who's making the request, or null if invalid/missing. */
export interface Verifier {
  verify(authHeader: string | undefined): Promise<AuthContext | null>;
}
