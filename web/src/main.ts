import { DECK_SCHEMA_VERSION, safeParseDeck, type NewDeck } from "@flowio/shared";
import { installErrorReporter } from "./errorReporter.js";

installErrorReporter();

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
    const toSave = sampleDeck();
    const createRes = await fetch(`${API_URL}/decks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toSave),
    });
    if (!createRes.ok) {
      lines.push(`POST /decks failed: ${createRes.status}`);
      log(lines);
      return;
    }
    const created: unknown = await createRes.json();
    lines.push(`Created deck: ${JSON.stringify(created)}`);

    const createdParsed = safeParseDeck(created);
    if (!createdParsed.success) {
      lines.push("FAIL: response from POST /decks does not match the deck schema");
      log(lines);
      return;
    }

    const getRes = await fetch(`${API_URL}/decks/${createdParsed.data.id}`);
    if (!getRes.ok) {
      lines.push(`GET /decks/:id failed: ${getRes.status}`);
      log(lines);
      return;
    }
    const fetched: unknown = await getRes.json();
    const fetchedParsed = safeParseDeck(fetched);
    if (!fetchedParsed.success) {
      lines.push("FAIL: response from GET /decks/:id does not match the deck schema");
      log(lines);
      return;
    }

    const unchanged =
      JSON.stringify(fetchedParsed.data) === JSON.stringify(createdParsed.data);
    lines.push(`Fetched deck: ${JSON.stringify(fetched)}`);
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
