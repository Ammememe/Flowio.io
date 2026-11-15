// P0-3/P4-3: runs the embedding model off the main thread so slide animation never stutters.
// Ported from the Phase 0 spike, unchanged.
import { pipeline } from "@huggingface/transformers";

type Request =
  | { type: "load"; model: string; device: "wasm" | "webgpu" }
  | { type: "embed"; id: number; texts: string[] };

const post = (message: unknown) => (self as unknown as Worker).postMessage(message);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

self.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.type === "load") {
      extractor = await pipeline("feature-extraction", msg.model, {
        device: msg.device,
        dtype: msg.device === "webgpu" ? "fp32" : "q8",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (p: any) => {
          if (p.status === "progress") post({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
        },
      });
      post({ type: "ready" });
    } else {
      const started = performance.now();
      const output = await extractor(msg.texts, { pooling: "mean", normalize: true });
      post({ type: "vectors", id: msg.id, vectors: output.tolist(), ms: performance.now() - started });
    }
  } catch (err) {
    post({ type: "error", id: msg.type === "embed" ? msg.id : -1, message: err instanceof Error ? err.message : String(err) });
  }
};
