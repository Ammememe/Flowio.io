import { sampleDeck } from "../deck/sampleDeck.js";
import { startPresenting } from "./presentMode.js";
import "./style.css";

const container = document.querySelector<HTMLDivElement>("#present-container")!;
startPresenting(sampleDeck, container);

const hud = document.querySelector<HTMLDivElement>("#present-hud");
if (hud) {
  hud.textContent = "← → navigate · 1-9 emphasize · 0 clear · t theme · f fullscreen";
}
