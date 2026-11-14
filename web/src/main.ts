import { DECK_SCHEMA_VERSION, type NewDeck } from "@flowio/shared";
import { createDeck, getDeck } from "./api/client.js";
import { getCurrentUser, signIn } from "./auth/devAuth.js";
import { installErrorReporter } from "./errorReporter.js";

installErrorReporter();

// Phase 3 (P3-1) requires every /decks call to be authenticated. This demo
// page predates sign-in, so it signs itself in with a fixed dev identity
// rather than sending you to /signin.html first -- it's just proving the
// API round-trips a deck, not exercising real auth.
if (!getCurrentUser()) signIn("hello-world@flowio.local");

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

const output = document.querySelector<HTMLPreElement>("#output")!;
const button = document.querySelector<HTMLButtonElement>("#run")!;

function sampleDeck(): NewDeck {
  return {
    schemaVersion: DECK_SCHEMA_VERSION,
    title: "Hello world deck",
    themeId: "theme-a",
    language: "en",
    slides: [
      {
        id: "slide_1",
        layout: "bullets",
        elements: [
          { id: "el_1", type: "bullet", text: "The API saved this bullet", cues: [] },
        ],
      },
    ],
  };
}

function log(lines: string[]): void {
  output.textContent = lines.join("\n");
}

async function run(): Promise<void> {
  button.disabled = true;
  const lines: string[] = [`Calling API at ${API_URL} ...`];
  log(lines);

  try {
    const created = await createDeck(sampleDeck());
    lines.push(`Created deck: ${JSON.stringify(created)}`);

    const fetched = await getDeck(created.id);
    lines.push(`Fetched deck: ${JSON.stringify(fetched)}`);

    const unchanged = JSON.stringify(fetched) === JSON.stringify(created);
    lines.push(
      unchanged
        ? "PASS: deck round-tripped through the API unchanged (P1-6 exit test)."
        : "FAIL: fetched deck differs from created deck.",
    );
  } catch (err) {
    lines.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    log(lines);
    button.disabled = false;
  }
}

button.addEventListener("click", () => void run());
