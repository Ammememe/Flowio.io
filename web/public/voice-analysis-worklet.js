// P6-3: collects microphone audio into ~128 ms windows (2048 samples at
// 16 kHz -- long enough to contain several cycles even at a low male
// voice's ~80 Hz fundamental) and measures loudness (RMS) and pitch on the
// audio thread itself, posting just the two numbers back rather than raw
// samples. Used by src/present/voiceAnalyzer.ts.
//
// detectPitch here must stay in lock-step with src/present/pitchDetect.ts
// -- that file is the unit-tested, canonical version (see
// test/present/pitchDetect.test.ts); this one exists only because an
// AudioWorkletProcessor can't `import` it.
function detectPitch(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return null;

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

  const prev = bestLag > 0 ? correlations[bestLag - 1] : bestValue;
  const next = bestLag < correlations.length - 1 ? correlations[bestLag + 1] : bestValue;
  const denom = prev - 2 * bestValue + next;
  const refinedLag = denom !== 0 ? bestLag + (prev - next) / (2 * denom) : bestLag;
  if (refinedLag <= 0) return null;

  const frequency = sampleRate / refinedLag;
  return frequency >= 70 && frequency <= 400 ? frequency : null;
}

class VoiceAnalysis extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.filled++] = channel[i];
        if (this.filled === this.buffer.length) {
          let sum = 0;
          for (let j = 0; j < this.buffer.length; j++) sum += this.buffer[j] * this.buffer[j];
          const rms = Math.sqrt(sum / this.buffer.length);
          const pitchHz = detectPitch(this.buffer, sampleRate);
          this.port.postMessage({ rms, pitchHz });
          this.filled = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('voice-analysis', VoiceAnalysis);
