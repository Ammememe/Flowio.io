/**
 * Autocorrelation-based fundamental frequency estimate (P6-3).
 *
 * Mirrors the algorithm in `public/voice-analysis-worklet.js` line for line
 * -- that copy has to be plain JS with no imports (an AudioWorkletProcessor
 * can't import modules the way this file can), so the two are duplicated on
 * purpose. If you change the algorithm here, change it there too; this
 * file exists mainly so it's unit-testable at all (see
 * `test/present/pitchDetect.test.ts`, which checks it against synthetic
 * sine waves of a known frequency).
 *
 * Returns null if the window is too quiet to have a reliable pitch
 * (silence, breath noise, unvoiced consonants) or the detected frequency
 * falls outside the human voice's fundamental range.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return null;

  // Trim leading/trailing near-silence so the autocorrelation isn't thrown
  // off by quiet padding at the edges of the window.
  const threshold = rms * 0.5;
  let start = 0;
  while (start < buffer.length && Math.abs(buffer[start]) < threshold) start++;
  let end = buffer.length - 1;
  while (end > start && Math.abs(buffer[end]) < threshold) end--;
  const trimmed = buffer.subarray(start, end + 1);
  if (trimmed.length < 2) return null;

  const correlations = new Float32Array(trimmed.length);
  for (let lag = 0; lag < trimmed.length; lag++) {
    let sum = 0;
    for (let i = 0; i < trimmed.length - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    correlations[lag] = sum;
  }

  // Lag 0 is always the peak (perfect self-correlation) -- skip the initial
  // downslope so the first real peak found afterward is the period, not
  // an artifact of lag 0's neighbourhood.
  let lag = 1;
  while (lag < correlations.length - 1 && correlations[lag] > correlations[lag + 1]) lag++;

  let bestLag = -1;
  let bestValue = -Infinity;
  for (let i = lag; i < correlations.length; i++) {
    if (correlations[i] > bestValue) {
      bestValue = correlations[i];
      bestLag = i;
    }
  }
  if (bestLag <= 0) return null;

  // Parabolic interpolation around the peak for sub-sample precision --
  // without it, pitch estimates only land on `sampleRate / integer` values.
  const prev = bestLag > 0 ? correlations[bestLag - 1] : bestValue;
  const next = bestLag < correlations.length - 1 ? correlations[bestLag + 1] : bestValue;
  const denom = prev - 2 * bestValue + next;
  const refinedLag = denom !== 0 ? bestLag + (prev - next) / (2 * denom) : bestLag;
  if (refinedLag <= 0) return null;

  const frequency = sampleRate / refinedLag;
  // Human voice fundamentals run roughly 70-400 Hz; outside that it's more
  // likely noise or an autocorrelation artifact than a real pitch.
  return frequency >= 70 && frequency <= 400 ? frequency : null;
}
