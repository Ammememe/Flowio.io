import { el } from "../render/dom.js";
import { listAudioInputDevices, MicPcm } from "../speech/micPcm.js";

/**
 * P4-6: microphone permission, device picker and a pre-talk sound check,
 * shown once before the presenter first turns the mic on.
 *
 * Caveat shown in the UI, not hidden: the Web Speech API (the P4-1
 * transcription source for now) always listens on the system's default
 * input device -- it has no way to target a specific device. The picker
 * here still matters for the level check itself, and will matter for real
 * once a getUserMedia-based source (e.g. Amazon Transcribe) replaces it.
 */
export function showSoundCheck(onConfirm: () => void, onCancel: () => void): { destroy(): void } {
  const mic = new MicPcm();
  let selectedDeviceId: string | undefined;

  const levelBar = el("div", { class: "soundcheck__level-fill" });
  const deviceSelect = el("select", { class: "soundcheck__device" }) as HTMLSelectElement;
  const permissionNote = el("p", { class: "soundcheck__note" }, [
    "Requesting microphone permission...",
  ]);

  const startButton = el("button", { class: "primary", attrs: { type: "button", disabled: "true" } }, [
    "Start listening",
  ]) as HTMLButtonElement;
  const cancelButton = el("button", { class: "secondary", attrs: { type: "button" } }, ["Not now"]);

  const overlay = el("div", { class: "soundcheck-overlay" }, [
    el("div", { class: "soundcheck" }, [
      el("h2", {}, ["Sound check"]),
      permissionNote,
      el("label", { class: "soundcheck__label" }, ["Microphone", deviceSelect]),
      el("div", { class: "soundcheck__level-track" }, [levelBar]),
      el("p", { class: "soundcheck__hint" }, [
        "Say a few words -- the bar should move. Live transcription always uses your system's default microphone, whichever one is selected here.",
      ]),
      el("p", { class: "soundcheck__consent" }, [
        // P4-10: audio is never stored on our side. Today's transcription source (Web
        // Speech API, see speech/webSpeech.ts) sends audio to your browser's speech
        // recognition service (Google's, in Chrome) to produce the live transcript --
        // this is disclosed, not hidden, and will read differently once a
        // privacy-reviewed EU-region provider (Amazon Transcribe) replaces it.
        "Starting the microphone sends your speech to your browser's built-in speech recognition service to generate a live transcript. We never store the audio ourselves.",
      ]),
      el("div", { class: "soundcheck__actions" }, [cancelButton, startButton]),
    ]),
  ]);
  document.body.append(overlay);

  async function populateDevices(): Promise<void> {
    const devices = await listAudioInputDevices();
    deviceSelect.innerHTML = "";
    devices.forEach((d, i) => {
      const option = el("option", { attrs: { value: d.deviceId } }, [d.label || `Microphone ${i + 1}`]) as HTMLOptionElement;
      deviceSelect.append(option);
    });
    selectedDeviceId = devices[0]?.deviceId;
  }

  async function startLevelMeter(deviceId?: string): Promise<void> {
    mic.stop();
    mic.onChunk((_pcm, rms) => {
      levelBar.style.width = `${Math.min(100, Math.round(rms * 400))}%`;
    });
    await mic.start(deviceId);
  }

  async function init(): Promise<void> {
    try {
      await mic.start(); // triggers the permission prompt
      permissionNote.textContent = "Microphone connected. Choose a device and check the level below.";
      await populateDevices();
      await startLevelMeter(selectedDeviceId);
      startButton.disabled = false;
    } catch (err) {
      permissionNote.textContent = `Could not access the microphone: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  void init();

  deviceSelect.addEventListener("change", () => {
    selectedDeviceId = deviceSelect.value;
    void startLevelMeter(selectedDeviceId);
  });

  function cleanup(): void {
    mic.stop();
    overlay.remove();
  }

  startButton.addEventListener("click", () => {
    cleanup();
    onConfirm();
  });
  cancelButton.addEventListener("click", () => {
    cleanup();
    onCancel();
  });

  return { destroy: cleanup };
}
