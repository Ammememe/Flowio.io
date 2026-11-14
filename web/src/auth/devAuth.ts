/**
 * P3-1 local stand-in for Cognito Hosted UI. There's nothing deployed to
 * redirect to yet, so "signing in" here just means typing an email, which
 * becomes the `Authorization: Bearer dev:<email>` header the API's
 * `DevVerifier` accepts (see `api/src/auth/devVerifier.ts`). Swap this
 * module for a real `@aws-sdk` Cognito OAuth redirect flow once the user
 * pool is deployed -- nothing that calls `getAuthHeader()`/`getCurrentUser()`
 * needs to change.
 */

const STORAGE_KEY = "flowio.devAuth.email";

export interface CurrentUser {
  email: string;
}

export function getCurrentUser(): CurrentUser | null {
  const email = localStorage.getItem(STORAGE_KEY);
  return email ? { email } : null;
}

export function signIn(email: string): CurrentUser {
  const trimmed = email.trim();
  if (!trimmed) throw new Error("Email is required");
  localStorage.setItem(STORAGE_KEY, trimmed);
  return { email: trimmed };
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Value for the `Authorization` header, or null if not signed in. */
export function getAuthHeader(): string | null {
  const user = getCurrentUser();
  return user ? `Bearer dev:${user.email}` : null;
}

/** Redirects to the sign-in page if nobody's signed in. Call at the top of any page that needs a user. */
export function requireSignIn(signInUrl = "/signin.html"): CurrentUser {
  const user = getCurrentUser();
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    location.href = `${signInUrl}?returnTo=${returnTo}`;
    throw new Error("Not signed in -- redirecting");
  }
  return user;
}
