import { describe, expect, it } from "vitest";
import { toSlide } from "../src/slideInput.js";

describe("toSlide", () => {
  it("mints ids for the slide and every element", () => {
    const slide = toSlide({
      layout: "bullets",
      elements: [
        { type: "title", text: "Heading" },
        { type: "bullet", text: "Point one" },
      ],
    });
    expect(slide.id).toBeTruthy();
    expect(slide.elements).toHaveLength(2);
    for (const el of slide.elements) expect(el.id).toBeTruthy();
    expect(new Set(slide.elements.map((e) => e.id)).size).toBe(2);
  });

  it("defaults missing cues to an empty array", () => {
    const slide = toSlide({ layout: "bullets", elements: [{ type: "bullet", text: "No cues given" }] });
    expect(slide.elements[0]).toMatchObject({ type: "bullet", text: "No cues given", cues: [] });
  });

  it("keeps cues when given", () => {
    const slide = toSlide({
      layout: "bullets",
      elements: [{ type: "bullet", text: "Lift", cues: ["wing shape", "faster air on top"] }],
    });
    expect(slide.elements[0]).toMatchObject({ cues: ["wing shape", "faster air on top"] });
  });

  it("maps image elements, defaulting alt text to an empty string", () => {
    const slide = toSlide({ layout: "full-image", elements: [{ type: "image", src: "https://example.com/a.png" }] });
    expect(slide.elements[0]).toMatchObject({ type: "image", src: "https://example.com/a.png", alt: "" });
  });

  it("carries speaker notes through unchanged", () => {
    const slide = toSlide({ layout: "title", elements: [], notes: "Remember to breathe" });
    expect(slide.notes).toBe("Remember to breathe");
  });
});
