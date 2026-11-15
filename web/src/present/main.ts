import { getDeck } from "../api/client.js";
import { sampleDeck } from "../deck/sampleDeck.js";
import { startPresenting, type Presenter } from "./presentMode.js";
import { showSoundCheck } from "./soundCheck.js";
import "./style.css";
import type { ListeningStatus } from "./liveEngine.js";

const container = document.querySelector<HTMLDivElement>("#present-container")!;
const hud = document.querySelector<HTMLDivElement>("#present-hud");
const liveStatusEl = document.querySelector<HTMLDivElement>("#live-status")!;
const micButton = document.querySelector<HTMLButtonElement>("#mic-toggle")!;

function setHud(text: string): void {
  if (hud) hud.textContent = text;
}

function statusLabel(listening: ListeningStatus, following: boolean): string {
  const mic = {
    idle: "mic off",
    starting: "connecting...",
    listening: "listening",
    reconnecting: "reconnecting...", // P4-7: silent fallback, shown quietly here, never as an alarming error
    unsupported: "live transcription unsupported",
    denied: "microphone permission denied",
  }[listening];
  return `🎤 ${mic} · following ${following ? "on" : "off"} (g)`;
}

function run(deck: Parameters<typeof startPresenting>[0]): void {
  // P4-6: the sound check is shown once, the first time the mic is turned
  // on -- from either the button or the 'm' key, which is why this gate
  // lives in `onMicToggleRequested` rather than in the button's click handler.
  let soundCheckShown = false;

  const presenter: Presenter = startPresenting(deck, container, {
    onLiveStatusChange({ micOn, following, listening, detail }) {
      micButton.textContent = micOn ? "🎤 Mute microphone" : "🎤 Enable microphone";
      micButton.classList.toggle("live-mic-button--on", micOn);
      liveStatusEl.textContent = statusLabel(listening, following);
      liveStatusEl.title = detail ?? "";
      liveStatusEl.hidden = listening === "idle" && !micOn;
    },
    onMicToggleRequested(turnOn) {
      if (!turnOn || soundCheckShown) {
        presenter.setMicOn(turnOn);
        return;
      }
      soundCheckShown = true;
      showSoundCheck(
        (deviceId) => {
          presenter.setPreferredDeviceId(deviceId);
          presenter.setMicOn(true);
        },
        () => {},
      );
    },
  });

  micButton.addEventListener("click", () => presenter.requestMicToggle());

  setHud("← → navigate · 1-9 emphasize · 0 clear · t theme · m mic · g following · f fullscreen");
}

async function main(): Promise<void> {
  const deckId = new URLSearchParams(location.search).get("deckId");

  // No ?deckId= -> the Phase 2 demo deck (unauthenticated, no API call).
  if (!deckId) {
    run(sampleDeck);
    return;
  }

  // P3-3/P3-4: present a real deck saved through the editor.
  try {
    const deck = await getDeck(deckId);
    run(deck);
  } catch (err) {
    container.textContent = `Could not load deck: ${err instanceof Error ? err.message : String(err)}`;
  }
}

void main();
