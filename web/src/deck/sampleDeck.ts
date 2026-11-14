import { DECK_SCHEMA_VERSION, type Deck } from "@flowio/shared";

/**
 * The deck Phase 2 presents for its exit test ("the spike deck presents in
 * both themes"). Slides 2, 4 and 6 are the three bullet slides from the
 * Phase 0 spike (`live-slides-spike/src/deck.ts`, deck `airplanes-en`),
 * ported into schema v1 with their cues intact. The rest are new slides
 * added only to exercise the other five layout templates (P2-2).
 */
export const sampleDeck: Deck = {
  schemaVersion: DECK_SCHEMA_VERSION,
  id: "deck_sample_airplanes",
  title: "How airplanes fly",
  themeId: "theme-a",
  language: "en",
  slides: [
    {
      id: "slide_title",
      layout: "title",
      elements: [
        { id: "el_title_main", type: "title", text: "How airplanes fly", cues: [] },
        {
          id: "el_title_sub",
          type: "title",
          text: "Phase 2 renderer and theme demo",
          cues: [],
        },
      ],
    },
    {
      id: "slide_s1",
      layout: "bullets",
      elements: [
        { id: "el_s1_title", type: "title", text: "How a wing creates lift", cues: [] },
        {
          id: "s1b1",
          type: "bullet",
          text: "The curved wing shape speeds up the air on top",
          cues: [
            "the wing is rounded on the upper side",
            "air has to travel faster over the wing",
          ],
        },
        {
          id: "s1b2",
          type: "bullet",
          text: "Lower pressure above pulls the wing upward",
          cues: [
            "a pressure difference between the top and the bottom",
            "the wing gets sucked upward",
          ],
        },
        {
          id: "s1b3",
          type: "bullet",
          text: "Tilting the wing increases lift: the angle of attack",
          cues: [
            "the pilot raises the nose to get more lift",
            "the angle between the wing and the oncoming air",
          ],
        },
        {
          id: "s1b4",
          type: "bullet",
          text: "Tilt too far and the wing stalls",
          cues: ["the airflow separates and the lift disappears", "a stall is when the wing stops flying"],
        },
      ],
    },
    {
      id: "slide_s2",
      layout: "bullets-image",
      elements: [
        { id: "el_s2_title", type: "title", text: "Engines and thrust", cues: [] },
        {
          id: "s2b1",
          type: "bullet",
          text: "A jet engine pulls in air and compresses it",
          cues: ["the fan at the front sucks in huge amounts of air", "the compressor squeezes the air"],
        },
        {
          id: "s2b2",
          type: "bullet",
          text: "Fuel burns and hot gas blasts out the back",
          cues: ["kerosene is ignited in the combustion chamber", "the exhaust pushes the plane forward"],
        },
        {
          id: "s2b3",
          type: "bullet",
          text: "Modern turbofans send most air around the core",
          cues: ["bypass air makes the engine quieter and more efficient", "the big fan does most of the work"],
        },
        {
          id: "s2b4",
          type: "bullet",
          text: "Propellers win on short, slow routes",
          cues: ["turboprops are cheaper for regional flights", "propeller planes burn less fuel at low speed"],
        },
        { id: "el_s2_image", type: "image", src: "/placeholder-engine.svg", alt: "Turbofan engine diagram", cues: [] },
      ],
    },
    {
      id: "slide_s3",
      layout: "bullets",
      elements: [
        { id: "el_s3_title", type: "title", text: "Staying in control", cues: [] },
        {
          id: "s3b1",
          type: "bullet",
          text: "Ailerons on the wings roll the plane",
          cues: ["the flaps at the wingtips bank the aircraft left or right", "rolling into a turn"],
        },
        {
          id: "s3b2",
          type: "bullet",
          text: "The elevator on the tail pitches the nose up or down",
          cues: ["pulling back on the stick to climb", "the horizontal tail controls climbing and descending"],
        },
        {
          id: "s3b3",
          type: "bullet",
          text: "The rudder swings the nose left or right",
          cues: ["the vertical fin on the tail", "yaw, used mostly in crosswind landings"],
        },
        {
          id: "s3b4",
          type: "bullet",
          text: "The autopilot flies most of a modern flight",
          cues: ["computers handle the cruise", "pilots mainly fly by hand during takeoff and landing"],
        },
      ],
    },
    {
      id: "slide_full_image",
      layout: "full-image",
      elements: [
        { id: "el_full_image", type: "image", src: "/placeholder-sky.svg", alt: "An airplane climbing into the sky", cues: [] },
      ],
    },
    {
      id: "slide_quote",
      layout: "quote",
      elements: [
        {
          id: "el_quote_text",
          type: "title",
          text: "An airplane flies because it doesn't have the time to fall.",
          cues: [],
        },
        { id: "el_quote_attribution", type: "bullet", text: "Hangar folklore", cues: [] },
      ],
    },
    {
      id: "slide_closing",
      layout: "section-break",
      elements: [{ id: "el_closing", type: "title", text: "Thank you", cues: [] }],
    },
  ],
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
};
