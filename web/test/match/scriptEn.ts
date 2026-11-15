import type { ScriptLine } from "../../src/measure/simulate.js";

/**
 * A sample talk that paraphrases the bullets instead of reading them, with a
 * few off-topic asides. Ported from the Phase 0 spike
 * (live-slides-spike/src/deck.ts, `scriptEn`), with slide ids updated to
 * match `web/src/deck/sampleDeck.ts`'s "slide_s1"/"slide_s2"/"slide_s3".
 */
export const scriptEn: ScriptLine[] = [
  { slide: "slide_s1", bullet: null, text: "Hi everyone, thanks for coming. Today I want to explain something we all take for granted." },
  { slide: "slide_s1", bullet: "s1b1", text: "Let's start with the shape.| If you slice a wing and look at it from the side, the upper surface is rounded, so the air going over it has to move faster." },
  { slide: "slide_s1", bullet: "s1b2", text: "And faster air means the pressure drops.| So you end up with less pressure above than below, and that difference literally sucks the wing up." },
  { slide: "slide_s1", bullet: null, text: "It sounds a bit like magic the first time you hear it, I know." },
  { slide: "slide_s1", bullet: "s1b3", text: "Now the pilot can get more out of this by raising the nose| a little. That changes the angle at which the wing meets the oncoming air, and lift goes up." },
  { slide: "slide_s1", bullet: "s1b4", text: "But there is a limit. Go too steep| and the airflow separates from the surface, the lift collapses, and that is what we call a stall." },
  { slide: "slide_s2", bullet: "s2b1", text: "So how do we get moving in the first place? At the front of the engine there's a big fan that sucks in| enormous amounts of air and squeezes it together." },
  { slide: "slide_s2", bullet: "s2b2", text: "Then we add kerosene| and light it. The gas expands violently and shoots out the rear, and that pushes the whole aircraft forward." },
  { slide: "slide_s2", bullet: null, text: "By the way, if you've ever sat by the window you've probably noticed how huge these things have become." },
  { slide: "slide_s2", bullet: "s2b3", text: "That's because on today's airliners most of the air actually goes around| the hot core. This bypass flow is what makes them quieter and much more fuel efficient." },
  { slide: "slide_s2", bullet: "s2b4", text: "For short regional hops| though, a propeller plane is often the smarter choice. At lower speeds a turboprop simply burns less." },
  { slide: "slide_s3", bullet: "s3b1", text: "Finally, steering. Out on the wingtips| there are small hinged surfaces. Move one up and the other down and the plane banks into a turn." },
  { slide: "slide_s3", bullet: "s3b2", text: "At the back, the horizontal tail| does the climbing and descending. Pull the stick back and the nose comes up." },
  { slide: "slide_s3", bullet: "s3b3", text: "The vertical fin has its own hinged part. It yaws the nose sideways,| which matters most when you land in a crosswind." },
  { slide: "slide_s3", bullet: null, text: "Okay, we're almost at the end, just one more thing." },
  { slide: "slide_s3", bullet: "s3b4", text: "And honestly, for most of the trip nobody is hand flying| at all. The computers handle the cruise, and the crew takes over for takeoff and landing." },
];
