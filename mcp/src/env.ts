/**
 * Config for the MCP server (P5-2). Pre-OAuth (P5-1 comes last, by explicit
 * choice -- see the phase plan), every tool call acts as one fixed identity
 * read from `FLOWIO_MCP_DEV_EMAIL`, using the same `Bearer dev:<email>`
 * convention the web app's local dev stand-in already uses (see
 * `api/src/auth/devVerifier.ts`). Point `FLOWIO_API_URL` at the local dev
 * API (`pnpm --filter api run dev`) so a deck Claude creates shows up by
 * opening the local dashboard signed in as the same email. Swap this whole
 * module for a real per-connection Cognito identity once P5-1 lands --
 * nothing in `tools.ts` needs to change, only how `ownerEmail` is obtained.
 */

try {
  process.loadEnvFile();
} catch {
  // No .env file next to this package: rely on the environment as it is.
}

export const API_URL = process.env.FLOWIO_API_URL ?? "http://localhost:8787";
export const WEB_URL = process.env.FLOWIO_WEB_URL ?? "http://localhost:5174";
export const DEV_EMAIL = process.env.FLOWIO_MCP_DEV_EMAIL ?? "claude@flowio.local";
