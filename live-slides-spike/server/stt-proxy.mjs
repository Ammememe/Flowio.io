// Local helper for the provider comparison (P0-8). Not part of the product.
//
// The browser sends 16 kHz, 16-bit mono audio to this process over a WebSocket on localhost.
// This process forwards it to Deepgram or Amazon Transcribe using credentials from .env or your
// AWS profile, and sends the transcripts back. Credentials never reach the browser.
//
//   ws://localhost:8787/stt/deepgram?lang=en-US
//   ws://localhost:8787/stt/transcribe?lang=sv-SE
//   http://localhost:8787/health

import http from 'node:http';
import { StartStreamTranscriptionCommand, TranscribeStreamingClient } from '@aws-sdk/client-transcribe-streaming';
import { WebSocket, WebSocketServer } from 'ws';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the environment as it is.
}

const PORT = Number(process.env.STT_PROXY_PORT ?? 8787);
const TRANSCRIBE_REGION = process.env.TRANSCRIBE_REGION ?? 'eu-west-1';
const DEEPGRAM_URL = process.env.DEEPGRAM_URL ?? 'wss://api.deepgram.com/v1/listen';
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL ?? 'nova-3';
const SAMPLE_RATE = 16000;

// Only pages served from this machine may use the proxy, so no other website can spend your credits.
const isLocalOrigin = (origin) => !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const send = (client, message) => {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
};

// ---------- Deepgram ----------

function deepgram(client, lang) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    send(client, { type: 'error', message: 'DEEPGRAM_API_KEY is not set in .env.' });
    client.close();
    return;
  }
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    language: lang.split('-')[0],
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
    channels: '1',
    interim_results: 'true',
    punctuate: 'true',
  });
  const upstream = new WebSocket(`${DEEPGRAM_URL}?${params}`, { headers: { Authorization: `Token ${key}` } });
  const backlog = [];
  let segment = 0;

  client.on('message', (data, isBinary) => {
    if (!isBinary) return;
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
    else if (upstream.readyState === WebSocket.CONNECTING) backlog.push(data);
  });
  client.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({ type: 'CloseStream' }));
      upstream.close();
    } else {
      upstream.terminate();
    }
  });

  upstream.on('open', () => {
    for (const chunk of backlog.splice(0)) upstream.send(chunk);
  });
  upstream.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== 'Results') return;
    // Each message carries the whole text of the current stretch of audio; a final one closes that stretch.
    const text = msg.channel?.alternatives?.[0]?.transcript ?? '';
    if (text) {
      send(client, {
        type: 'transcript',
        segmentId: `dg-${segment}`,
        text,
        isFinal: Boolean(msg.is_final),
        audioEnd: (msg.start ?? 0) + (msg.duration ?? 0),
      });
    }
    if (msg.is_final) segment++;
  });
  upstream.on('unexpected-response', (request, response) => {
    send(client, {
      type: 'error',
      message: `Deepgram refused the connection (HTTP ${response.statusCode}). Check the key, DEEPGRAM_MODEL and the language.`,
    });
    response.resume();
    request.destroy();
    client.close();
  });
  upstream.on('error', (err) => send(client, { type: 'error', message: `Deepgram: ${err.message}` }));
  upstream.on('close', () => client.close());
}

// ---------- Amazon Transcribe ----------

function createQueue() {
  const items = [];
  let wake = null;
  let ended = false;
  return {
    push(item) {
      items.push(item);
      wake?.();
    },
    end() {
      ended = true;
      wake?.();
    },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        if (items.length) yield items.shift();
        else if (ended) return;
        else {
          await new Promise((resolve) => (wake = resolve));
          wake = null;
        }
      }
    },
  };
}

async function transcribe(client, lang) {
  const queue = createQueue();
  client.on('message', (data, isBinary) => {
    if (isBinary) queue.push(data);
  });
  client.on('close', () => queue.end());

  async function* audio() {
    for await (const chunk of queue) yield { AudioEvent: { AudioChunk: chunk } };
  }

  try {
    const aws = new TranscribeStreamingClient({ region: TRANSCRIBE_REGION });
    const response = await aws.send(
      new StartStreamTranscriptionCommand({
        LanguageCode: lang,
        MediaEncoding: 'pcm',
        MediaSampleRateHertz: SAMPLE_RATE,
        AudioStream: audio(),
      }),
    );
    for await (const event of response.TranscriptResultStream ?? []) {
      for (const result of event.TranscriptEvent?.Transcript?.Results ?? []) {
        const text = result.Alternatives?.[0]?.Transcript ?? '';
        if (!text) continue;
        send(client, {
          type: 'transcript',
          segmentId: `tr-${result.ResultId}`,
          text,
          isFinal: !result.IsPartial,
          audioEnd: result.EndTime,
        });
      }
    }
  } catch (err) {
    send(client, { type: 'error', message: `Amazon Transcribe (${TRANSCRIBE_REGION}): ${err?.name ?? 'Error'}: ${err?.message ?? err}` });
  } finally {
    client.close();
  }
}

let awsCheck = null;
function awsReady() {
  // Resolving credentials can take a moment (profiles, SSO), so do it once and give up after 4 s.
  awsCheck ??= Promise.race([
    new TranscribeStreamingClient({ region: TRANSCRIBE_REGION }).config
      .credentials()
      .then(() => true)
      .catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(false), 4000)),
  ]);
  return awsCheck;
}

// ---------- Server ----------

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (!isLocalOrigin(origin)) {
    res.writeHead(403).end();
    return;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ deepgram: Boolean(process.env.DEEPGRAM_API_KEY), transcribe: await awsReady() }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server, verifyClient: ({ origin }) => isLocalOrigin(origin) });
wss.on('connection', (client, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const lang = url.searchParams.get('lang') ?? 'en-US';
  if (url.pathname === '/stt/deepgram') deepgram(client, lang);
  else if (url.pathname === '/stt/transcribe') void transcribe(client, lang);
  else client.close(1008, 'Unknown provider');
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`STT proxy listening on http://localhost:${PORT}`);
  console.log(`  Deepgram:          ${process.env.DEEPGRAM_API_KEY ? `key found, model ${DEEPGRAM_MODEL}` : 'no DEEPGRAM_API_KEY in .env'}`);
  console.log(`  Amazon Transcribe: ${(await awsReady()) ? `credentials found, region ${TRANSCRIBE_REGION}` : 'no AWS credentials found'}`);
});
