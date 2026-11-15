// Browser-side handle to the embedding worker. Ported from the Phase 0 spike, unchanged.
import type { Embedder } from "./scorer.js";

export interface ModelOption {
  id: string;
  label: string;
  languages: string[];
}

export const MODELS: ModelOption[] = [
  { id: "Xenova/all-MiniLM-L6-v2", label: "English, small (about 25 MB download)", languages: ["en"] },
  {
    id: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    label: "Multilingual, incl. Swedish (about 120 MB download)",
    languages: ["en", "sv"],
  },
];

export interface WorkerEmbedder extends Embedder {
  /** Rolling average time for one embedding call, in ms. Answers "fast enough on this laptop?". */
  readonly avgMs: number;
  readonly device: "wasm" | "webgpu";
  dispose(): void;
}

export function loadWorkerEmbedder(
  model: string,
  device: "wasm" | "webgpu",
  onProgress: (text: string) => void,
): Promise<WorkerEmbedder> {
  // Vite's special-cased `new URL("./x.ts", import.meta.url)` worker syntax --
  // this needs the literal .ts extension, unlike a normal static import.
  const worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let avgMs = 0;

  const embedder: WorkerEmbedder = {
    label: `${model} (${device})`,
    device,
    get avgMs() {
      return avgMs;
    },
    embed(texts) {
      return new Promise<number[][]>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "embed", id, texts });
      });
    },
    dispose() {
      worker.terminate();
      for (const p of pending.values()) p.reject(new Error("embedder disposed"));
      pending.clear();
    },
  };

  return new Promise((resolve, reject) => {
    worker.onerror = (e) => reject(new Error(e.message || "embedding worker failed to start"));
    worker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "progress") {
        const pct = msg.total ? Math.round((msg.loaded / msg.total) * 100) : 0;
        onProgress(`Downloading model: ${msg.file} ${pct}%`);
      } else if (msg.type === "ready") {
        resolve(embedder);
      } else if (msg.type === "vectors") {
        avgMs = avgMs ? avgMs * 0.8 + msg.ms * 0.2 : msg.ms;
        pending.get(msg.id)?.resolve(msg.vectors);
        pending.delete(msg.id);
      } else if (msg.type === "error") {
        if (msg.id === -1) {
          worker.terminate();
          reject(new Error(msg.message));
        } else {
          pending.get(msg.id)?.reject(new Error(msg.message));
          pending.delete(msg.id);
        }
      }
    };
    worker.postMessage({ type: "load", model, device });
  });
}
