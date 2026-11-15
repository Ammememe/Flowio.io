import { layoutIds, themeSummaries, type Deck } from "@flowio/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { DeckBackend } from "./backend.js";
import { deckEditorUrl } from "./deckLink.js";
import { ApiError } from "./errors.js";
import { elementInputSchema, slideInputSchema, toSlide, type SlideInput } from "./slideInput.js";

/** Short, human-readable blurb per layout -- the schema itself carries no description. */
const layoutDescriptions: Record<(typeof layoutIds)[number], string> = {
  title: "A title and subtitle, centered. Good for the first slide.",
  bullets: "A heading with a list of bullet points.",
  "bullets-image": "A heading, bullet points, and one image side by side.",
  "full-image": "A single image filling the slide, with an optional caption bullet.",
  quote: "One emphasized quote, optionally with an attribution bullet.",
  "section-break": "A short divider slide: just a title, used between sections of a talk.",
};

function ok(text: string, structuredContent?: Record<string, unknown>): CallToolResult {
  return structuredContent
    ? { content: [{ type: "text", text }], structuredContent }
    : { content: [{ type: "text", text }] };
}

function err(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Runs a tool body, turning API/schema failures into a CallToolResult Claude can read and react to, per P5-5. */
async function guarded(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      const issues = e.issues ? ` Details: ${JSON.stringify(e.issues)}` : "";
      return err(`${e.message} (HTTP ${e.status}).${issues}`);
    }
    return err(e instanceof Error ? e.message : String(e));
  }
}

function writeResult(action: string, deck: Deck): CallToolResult {
  const url = deckEditorUrl(deck.id);
  return ok(
    `${action} "${deck.title}" (${deck.slides.length} slide${deck.slides.length === 1 ? "" : "s"}, v${deck.version}). Open it: ${url}`,
    { deck, url },
  );
}

function findSlideIndex(deck: Deck, slideId: string): number {
  const index = deck.slides.findIndex((s) => s.id === slideId);
  if (index === -1) {
    throw new Error(
      `No slide with id "${slideId}" in deck "${deck.title}" (${deck.id}). ` +
        `Current slide ids: ${deck.slides.map((s) => s.id).join(", ") || "(none)"}.`,
    );
  }
  return index;
}

/** Registers every Phase 5 deck tool on `server` (P5-3/P5-4), storing decks through `backend`. */
export function registerDeckTools(server: McpServer, backend: DeckBackend): void {
  server.registerTool(
    "list_themes",
    { description: "List the themes a deck's `themeId` can be set to." },
    async () => ok(themeSummaries.map((t) => `${t.id} -- ${t.name}`).join("\n"), { themes: themeSummaries }),
  );

  server.registerTool(
    "list_layouts",
    { description: "List the slide layouts available for a slide's `layout` field." },
    async () =>
      ok(
        layoutIds.map((id) => `${id} -- ${layoutDescriptions[id]}`).join("\n"),
        { layouts: layoutIds.map((id) => ({ id, description: layoutDescriptions[id] })) },
      ),
  );

  server.registerTool(
    "list_decks",
    { description: "List existing decks, newest first." },
    async () =>
      guarded(async () => {
        const decks = await backend.listDecks();
        if (decks.length === 0) return ok("No decks yet.", { decks });
        const lines = decks.map((d) => `${d.id}  "${d.title}"  v${d.version}  ${deckEditorUrl(d.id)}`);
        return ok(lines.join("\n"), { decks });
      }),
  );

  server.registerTool(
    "get_deck",
    {
      description: "Get a deck's full content: title, theme, language, and every slide with its elements.",
      inputSchema: { deckId: z.string().min(1) },
    },
    async ({ deckId }) =>
      guarded(async () => {
        const deck = await backend.getDeck(deckId);
        return ok(JSON.stringify(deck, null, 2), { deck });
      }),
  );

  server.registerTool(
    "create_deck",
    {
      description:
        "Create a new deck. Returns a link that opens it in the editor. " +
        "Use list_themes and list_layouts first to pick valid `themeId`/`layout` values.",
      inputSchema: {
        title: z.string().min(1),
        themeId: z.string().min(1),
        language: z.enum(["sv", "en"]).default("en"),
        slides: z.array(slideInputSchema).min(1),
      },
    },
    async ({ title, themeId, language, slides }) =>
      guarded(async () => {
        const deck = await backend.createDeck({
          schemaVersion: 1,
          title,
          themeId,
          language,
          slides: slides.map(toSlide),
        });
        return writeResult("Created", deck);
      }),
  );

  server.registerTool(
    "add_slide",
    {
      description: "Add one slide to an existing deck, at `position` (0-based; defaults to the end).",
      inputSchema: {
        deckId: z.string().min(1),
        slide: slideInputSchema,
        position: z.number().int().min(0).optional(),
      },
    },
    async ({ deckId, slide, position }) =>
      guarded(async () => {
        const deck = await backend.getDeck(deckId);
        const newSlide = toSlide(slide);
        const slides = [...deck.slides];
        const at = position === undefined ? slides.length : Math.min(position, slides.length);
        slides.splice(at, 0, newSlide);
        const updated = await backend.updateDeck(deckId, { slides, expectedVersion: deck.version });
        return writeResult("Updated", updated);
      }),
  );

  server.registerTool(
    "update_slide",
    {
      description:
        "Update one slide in a deck. `elements`, if given, fully replaces that slide's elements " +
        "(elements keep no identity across this call -- cues and text must be given again for ones you keep).",
      inputSchema: {
        deckId: z.string().min(1),
        slideId: z.string().min(1),
        layout: slideInputSchema.shape.layout.optional(),
        elements: z.array(elementInputSchema).optional(),
        notes: z.string().optional(),
      },
    },
    async ({ deckId, slideId, layout, elements, notes }) =>
      guarded(async () => {
        const deck = await backend.getDeck(deckId);
        const index = findSlideIndex(deck, slideId);
        const current = deck.slides[index];
        const slides = [...deck.slides];
        slides[index] = {
          ...current,
          layout: layout ?? current.layout,
          elements: elements ? toSlide({ layout: layout ?? current.layout, elements } as SlideInput).elements : current.elements,
          notes: notes ?? current.notes,
        };
        const updated = await backend.updateDeck(deckId, { slides, expectedVersion: deck.version });
        return writeResult("Updated", updated);
      }),
  );

  server.registerTool(
    "delete_slide",
    {
      description: "Delete one slide from a deck.",
      inputSchema: { deckId: z.string().min(1), slideId: z.string().min(1) },
    },
    async ({ deckId, slideId }) =>
      guarded(async () => {
        const deck = await backend.getDeck(deckId);
        const index = findSlideIndex(deck, slideId);
        const slides = deck.slides.filter((_, i) => i !== index);
        const updated = await backend.updateDeck(deckId, { slides, expectedVersion: deck.version });
        return writeResult("Updated", updated);
      }),
  );

  server.registerTool(
    "reorder_slides",
    {
      description: "Reorder a deck's slides. `slideIds` must list every current slide id, in the new order.",
      inputSchema: { deckId: z.string().min(1), slideIds: z.array(z.string().min(1)).min(1) },
    },
    async ({ deckId, slideIds }) =>
      guarded(async () => {
        const deck = await backend.getDeck(deckId);
        const byId = new Map(deck.slides.map((s) => [s.id, s]));
        const currentIds = new Set(deck.slides.map((s) => s.id));
        const newIds = new Set(slideIds);
        if (slideIds.length !== deck.slides.length || currentIds.size !== newIds.size || ![...currentIds].every((id) => newIds.has(id))) {
          throw new Error(
            `slideIds must be a reordering of all current slide ids: ${deck.slides.map((s) => s.id).join(", ")}.`,
          );
        }
        const slides = slideIds.map((id) => byId.get(id)!);
        const updated = await backend.updateDeck(deckId, { slides, expectedVersion: deck.version });
        return writeResult("Updated", updated);
      }),
  );
}
