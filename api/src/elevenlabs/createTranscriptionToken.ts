import type { AuthContext } from "../auth/types.js";
import type { HandlerResult } from "../handlers.js";
import { logger } from "../logger.js";

export interface TranscriptionToken {
  token: string;
}

/**
 * P4-1: mints a short-lived, single-use ElevenLabs Scribe token server-side
 * so the browser never sees the real API key -- exactly the "an API
 * endpoint issues short-lived credentials and the browser streams audio
 * directly to the provider" shape the plan asks for.
 *
 * https://elevenlabs.io/docs/api-reference/tokens/create (`realtime_scribe`
 * token type; the token is valid for 15 minutes and single-use).
 */
export async function createTranscriptionToken(
  auth: AuthContext | null,
  apiKey: string | undefined,
): Promise<HandlerResult<TranscriptionToken>> {
  if (!auth) return { ok: false, status: 401, error: "Missing or invalid Authorization header" };

  if (!apiKey) {
    // Not a server error -- the caller (web/src/speech/elevenLabsSource.ts
    // via liveEngine.ts) treats this as "ElevenLabs isn't configured" and
    // falls back to the Web Speech API rather than failing the whole mic.
    return { ok: false, status: 501, error: "ElevenLabs is not configured (ELEVENLABS_API_KEY unset)" };
  }

  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
    });
  } catch (err) {
    logger.error("createTranscriptionToken: request to ElevenLabs failed", { error: String(err) });
    return { ok: false, status: 502, error: "Could not reach ElevenLabs" };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("createTranscriptionToken: ElevenLabs rejected the request", { status: res.status, body });
    return { ok: false, status: 502, error: `ElevenLabs token request failed: ${res.status}` };
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    return { ok: false, status: 502, error: "ElevenLabs response had no token" };
  }

  return { ok: true, status: 200, body: { token: data.token } };
}
