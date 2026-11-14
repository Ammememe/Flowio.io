# Live Slides: Phase 0 spike

One question: when a presenter talks, does the bullet they are talking about highlight smoothly, or does it
feel twitchy? This is throwaway code that answers it. The parts worth keeping for Phase 4 are in `src/match`
and `src/measure`.

## Run it

Needs Node 22.12 or newer and Chrome or Edge.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

The first load downloads the embedding model from Hugging Face into the browser cache (about 25 MB for
English, about 120 MB for the multilingual one). If the download fails, the page says so and matches on
keywords only.

## Try it

1. **Without a microphone:** set Source to "Replay the sample talk" and press Start. A scripted talk plays
   word by word and the slide follows it. The numbers appear under Measurement when it ends.
2. **With your voice:** set Source to "Microphone: browser speech recognition", press Start, allow the
   microphone, and talk about the bullets in your own words. Use the arrow keys to change slide.
3. **Swedish:** switch Deck to the Swedish one. The multilingual model is selected for you.

The right-hand panel shows the live transcript, a score bar per bullet, and sliders for every stability
rule. Sliders apply immediately. Press `H` to hide the panel and see only the slide.

## Measure it (P0-7)

The exit test needs two numbers: how late the highlight is, and how often it is wrong.

**Live test, two people.** One presents. The other watches the slide and presses a number key the moment
they can tell which bullet the presenter is on (`1` to `9`), or `0` when the presenter goes off-topic. The
Measurement box then shows delay and wrong highlights per 10 bullets. Export the log as JSON to keep it.
Do this for 5 minutes, with 3 speakers, in both languages.

**Instant benchmark.** "Run instant benchmark" replays the sample talk as fast as the machine allows, using
the current slider settings and a simulated recognizer lag. Use it to tune thresholds, then confirm with
real speech. It also reports how long one embedding call takes on this machine.

### Two ways to count delay

The plan says "delay from starting a point to the highlight". Speakers usually open a point with a lead-in
("Now, how do we get moving in the first place?") that could belong to any bullet, and no matcher can know
the bullet before the speaker has said something that identifies it. So the replay reports both:

- **From start of the point:** includes the lead-in. In the sample talks this is 2 to 6 seconds whatever
  the matcher does.
- **From the cue point:** from the first moment a listener could tell which bullet it is. This is the number
  the matcher controls. The cue points are marked with `|` in the scripts in `src/deck.ts`.

The live test with an observer pressing keys measures the second kind. Decide which definition the 1.5 s
target applies to before judging the exit test.

### Baseline from this build

Sample talks, keyword-only matching (no embedding model), simulated recognizer lag 500 ms:

| Deck | Cues | Bullets found | Delay from cue point (median / 90th pct) | Within 1.5 s of cue | Wrong per 10 bullets |
| --- | --- | --- | --- | --- | --- |
| English | on | 12 of 12 | 0.6 s / 1.5 s | 92% | 1.7 |
| English | off | 9 of 12 | 1.0 s / 3.3 s | 50% | 3.3 |
| Swedish | on | 12 of 12 | 0.1 s / 1.9 s | 83% | 3.3 |
| Swedish | off | 9 of 12 | 0.9 s / 4.2 s | 50% | 4.2 |

Cue phrases matter a lot. With an embedding model loaded, run the benchmark again: those are the numbers to
compare against this table.

## Compare transcription providers (P0-8)

Open http://localhost:5173/compare.html. Every ticked provider hears the same microphone at the same time
while you read a reference text. You get, per provider, the time to first text after you start speaking and
the word error rate.

Browser speech recognition works out of the box. For Deepgram and Amazon Transcribe:

```bash
cp .env.example .env    # then fill it in
npm run stt-proxy       # in a second terminal
```

- **Deepgram:** put your API key in `.env`.
- **Amazon Transcribe:** uses your normal AWS credentials (environment variables, `~/.aws` profile or SSO).
  The identity needs `transcribe:StartStreamTranscription`. Set `TRANSCRIBE_REGION` to a region that offers
  streaming.

The proxy runs on your machine, listens on localhost only, refuses requests from other websites, and keeps
the keys out of the browser. Reload the page after starting it. Both providers then also appear as sources
on the presenter page.

## What was checked, and what was not

Checked here:

- 22 automated tests (`npm test`): text handling, rolling transcript window, keyword scoring, stability
  rules, metrics, word error rate, and both sample talks replayed end to end.
- Type check and production build.
- Both pages in headless Chrome: replay, highlight animation, keyboard controls, benchmark, Swedish deck,
  and the fallback when the model cannot be downloaded.
- The microphone path with a fake microphone and a fake Deepgram server: audio capture, 100 ms chunks at
  16 kHz, the proxy relay, live matching, markers and metrics.

Not checked, because the build environment had no access to them:

- **The real embedding model.** The model host was unreachable, so embedding-based matching ran only with a
  stand-in embedder. The Transformers.js calls match the installed version's type definitions. The default
  thresholds are therefore starting values, not tuned ones.
- **Real speech.** No microphone and no browser speech recognition in a headless browser.
- **Live Deepgram and Amazon Transcribe.** The proxy was exercised against a fake Deepgram server only. The
  Transcribe code follows the AWS SDK types and has not talked to AWS. Whether Deepgram's `nova-3` accepts
  Swedish was not confirmed; if it refuses, set `DEEPGRAM_MODEL=nova-2`.

## Where each issue lives

| Issue | Files |
| --- | --- |
| P0-1 Hardcoded deck as HTML | `src/deck.ts`, `src/render.ts` |
| P0-2 Live transcript, Web Speech API | `src/speech/webSpeech.ts` |
| P0-3 Embedding model in a Web Worker | `src/match/embed.worker.ts`, `src/match/workerEmbedder.ts` |
| P0-4 Matcher v0 | `src/match/matcher.ts`, `scorer.ts`, `keyword.ts`, `wordBuffer.ts`, `text.ts` |
| P0-5 Stability rules | `src/match/stabilizer.ts` |
| P0-6 Highlight animation | `src/style.css` (search for P0-6) |
| P0-7 Measurement | `src/measure/metrics.ts`, `src/measure/simulate.ts` |
| P0-8 Provider comparison | `compare.html`, `src/compare.ts`, `server/stt-proxy.mjs`, `src/speech/proxySource.ts` |

## How the matcher decides

1. Every bullet and cue phrase is embedded once when the deck loads.
2. A few times per second, the last 2.5 seconds and the last 6 seconds of transcript are scored against each
   bullet on the current slide: embedding similarity plus keyword overlap. Recent words count more.
3. A bullet is highlighted only if it clears a confidence threshold, leads the runner-up by a margin, and
   keeps that lead for a moment. A highlight stays for a minimum time, stays put when nothing qualifies, and
   fades after several seconds without support.

All of these values are sliders in the panel and fields in `DEFAULT_CONFIG` in `src/match/matcher.ts`.

## Known limits

- Markers measure highlight changes. A wrong bullet that simply stays highlighted counts as a miss for the
  next bullet, not as a wrong highlight.
- The speech-onset detector on the comparison page uses a fixed microphone level. Use a quiet room.
- If `npm install` fails on `onnxruntime-node` behind a restrictive network, run
  `ONNXRUNTIME_NODE_INSTALL_CUDA=skip npm install`.
