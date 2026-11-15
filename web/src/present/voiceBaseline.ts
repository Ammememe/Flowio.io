/**
 * P6-4/P6-5: pure running-statistics + scoring logic behind the voice
 * analyzer, pulled out of `voiceAnalyzer.ts` so it's testable without a
 * real microphone or AudioContext (see
 * `test/present/voiceBaseline.test.ts`).
 *
 * The first `calibrationMs` of readings (P6-4) only build up this
 * speaker's own baseline loudness/pitch -- intentionally not scored, since
 * there's nothing yet to compare against. After that, each reading is
 * scored by how many standard deviations above *this speaker's own*
 * average it is, not against any fixed volume -- a naturally loud or quiet
 * speaker is judged against themselves, not a stranger's threshold.
 */

/** Welford's online algorithm: mean and variance in one pass, no stored history. */
class RunningStats {
  private n = 0;
  private mean = 0;
  private m2 = 0;

  update(value: number): void {
    this.n += 1;
    const delta = value - this.mean;
    this.mean += delta / this.n;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  get count(): number {
    return this.n;
  }

  get average(): number {
    return this.mean;
  }

  get stdDev(): number {
    return this.n > 1 ? Math.sqrt(this.m2 / (this.n - 1)) : 0;
  }

  /** How many standard deviations `value` is above this stat's mean, 0 if there's no usable spread yet. */
  zScore(value: number): number {
    const sd = this.stdDev;
    return sd > 0 ? (value - this.mean) / sd : 0;
  }
}

export interface VoiceBaselineOptions {
  calibrationMs: number;
}

export class VoiceBaseline {
  private readonly loudness = new RunningStats();
  private readonly pitch = new RunningStats();
  private startedAt: number | null = null;
  private _calibrating = true;
  private _score = 0.5; // neutral while calibrating or without enough data to judge

  constructor(private readonly options: VoiceBaselineOptions) {}

  get calibrating(): boolean {
    return this._calibrating;
  }

  get score(): number {
    return this._score;
  }

  /** `now`: a monotonic clock reading (e.g. `performance.now()`), in the same units as `calibrationMs`. */
  record(now: number, rms: number, pitchHz: number | null): void {
    if (this.startedAt === null) this.startedAt = now;

    if (this._calibrating) {
      this.loudness.update(rms);
      if (pitchHz !== null) this.pitch.update(pitchHz);
      if (now - this.startedAt >= this.options.calibrationMs) this._calibrating = false;
      this._score = 0.5;
      return;
    }

    this.loudness.update(rms);
    if (pitchHz !== null) this.pitch.update(pitchHz);

    // Loudness always contributes; pitch only when this reading was voiced
    // and calibration actually saw enough voiced frames to have a baseline.
    const loudnessZ = this.loudness.zScore(rms);
    const havePitchBaseline = pitchHz !== null && this.pitch.count > 1;
    const pitchZ = havePitchBaseline ? this.pitch.zScore(pitchHz) : 0;
    const combinedZ = havePitchBaseline ? loudnessZ * 0.7 + pitchZ * 0.3 : loudnessZ;

    // A z-score of +/-2 (two standard deviations above/below this
    // speaker's own average) maps to roughly the 0..1 extremes.
    this._score = clamp01(0.5 + combinedZ * 0.25);
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
