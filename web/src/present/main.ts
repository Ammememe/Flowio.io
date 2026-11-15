import { getDeck } from "../api/client.js";
import { sampleDeck } from "../deck/sampleDeck.js";
import { presenterSyncChannelName, type PresenterSyncMessage } from "./presenterSync.js";
import { startPresenting, type Presenter } from "./presentMode.js";
import { showSoundCheck } from "./soundCheck.js";
import "./style.css";
import type { ListeningStatus } from "./liveEngine.js";

const container = document.querySelector<HTMLDivElement>("#present-container")!;
const hud = document.querySelector<HTMLDivElement>("#present-hud");
const liveStatusEl = document.querySelector<HTMLDivElement>("#live-status")!;
const micButton = document.querySelector<HTMLButtonElement>("#mic-toggle")!;
const captionsEl = document.querySelector<HTMLDivElement>("#captions")!;
const advanceSuggestionEl = document.querySelector<HTMLDivElement>("#advance-suggestion")!;
const voiceStatusEl = document.querySelector<HTMLDivElement>("#voice-status")!;

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

function run(deck: Parameters<typeof startPresenting>[0], deckId: string | null): void {
  // P4-6: the sound check is shown once, the first time the mic is turned
  // on -- from either the button or the 'm' key, which is why this gate
  // lives in `onMicToggleRequested` rather than in the button's click handler.
  let soundCheckShown = false;
  let advanceSuggestionTimer: ReturnType<typeof setTimeout> | undefined;

  function hideAdvanceSuggestion(): void {
    clearTimeout(advanceSuggestionTimer);
    advanceSuggestionEl.hidden = true;
  }

  // P6-2: a separate presenter-view window (same browser) can mirror and
  // drive this one -- see `presenterSync.ts`. Harmless if nothing is
  // listening on the other end.
  const syncChannel = new BroadcastChannel(presenterSyncChannelName(deckId));

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
    onSlideChange(index) {
      syncChannel.postMessage({ type: "slideChanged", index } satisfies PresenterSyncMessage);
      hideAdvanceSuggestion();
    },
    onCaptionsToggle(on) {
      captionsEl.hidden = !on;
      if (!on) captionsEl.textContent = "";
    },
    onCaptionUpdate(text) {
      captionsEl.textContent = text;
    },
    onAdvanceSuggested() {
      advanceSuggestionEl.hidden = false;
      clearTimeout(advanceSuggestionTimer);
      advanceSuggestionTimer = setTimeout(() => {
        advanceSuggestionEl.hidden = true;
      }, 4000);
    },
    onVoiceAnalyzerChange(score, calibrating) {
      voiceStatusEl.hidden = false;
      voiceStatusEl.textContent = calibrating
        ? "🎙️ voice: calibrating..."
        : `🎙️ voice: ${Math.round(score * 100)}%`;
    },
    onVoiceAnalyzerError(message) {
      voiceStatusEl.hidden = false;
      voiceStatusEl.textContent = `🎙️ voice analyzer unavailable (${message})`;
    },
    onVoiceAnalyzerToggle(on) {
      if (!on) voiceStatusEl.hidden = true;
    },
  });

  syncChannel.onmessage = (event: MessageEvent<PresenterSyncMessage>) => {
    if (event.data.type === "goTo") presenter.goToSlide(event.data.index);
  };
  // A presenter-view window opened after this one needs to know where this
  // one already is, without waiting for the next navigation.
  syncChannel.postMessage({ type: "slideChanged", index: presenter.slideIndex } satisfies PresenterSyncMessage);

  micButton.addEventListener("click", () => presenter.requestMicToggle());

  setHud("← → navigate · 1-9 emphasize · 0 clear · t theme · m mic · g following · c captions · a advance-suggest · v voice analyzer · f fullscreen");
}

async function main(): Promise<void> {
  const deckId = new URLSearchParams(location.search).get("deckId");

  // No ?deckId= -> the Phase 2 demo deck (unauthenticated, no API call).
  if (!deckId) {
    run(sampleDeck, null);
    return;
  }

  // P3-3/P3-4: present a real deck saved through the editor.
  try {
    const deck = await getDeck(deckId);
    run(deck, deckId);
  } catch (err) {
    container.textContent = `Could not load deck: ${err instanceof Error ? err.message : String(err)}`;
  }
}

void main();
