// Small text helpers for the keyword side of the matcher. English and Swedish only.
// Ported from the Phase 0 spike (P4-2): live-slides-spike/src/match/text.ts, unchanged.

const STOP_EN =
  'a an the and or but so if then than that this these those is are was were be been being am do does did done have has had having ' +
  'i you he she it we they me my your our their its his her them us of in on at to for from by with about as into over under up down ' +
  'out off not no nor too very can will just should would could may might must shall also there here when where why how what which ' +
  'who whom all any both each few more most other some such only own same now let lets like get gets got going go goes one two ' +
  'really actually thing things bit little well okay ok yeah yes um uh ve ll re don didn doesn isn aren won';

const STOP_SV =
  'och att det som en ett är av för på med till den har de inte om var jag du han hon vi ni man sig så men eller när från kan ska ' +
  'skulle också bara här där vad vem vilken vilket vilka hur alla någon något några mycket mer mest sin sitt sina min mitt mina din ' +
  'ditt dina vår vårt våra er ert era dem oss mig dig ju nog väl då nu ut upp in över under efter utan mot vid hos än åt blir blev ' +
  'bli vara varit hade ha får fick få gör göra gjorde lite liksom alltså typ okej ja nej denna detta dessa finns kommer går ' +
  'helt enkelt faktiskt säkert ofta';

const STOP = new Set(`${STOP_EN} ${STOP_SV}`.split(/\s+/));

/** Lowercased words, punctuation dropped. Keeps å, ä, ö and digits. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Words that carry meaning: stop words and one-letter tokens removed. */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => t.length > 1 && !STOP.has(t));
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * Loose word equality that survives inflection without a real stemmer:
 * "engine" ~ "engines", "lift" ~ "lifting", "vinge" ~ "vingar", "tryck" ~ "trycket".
 * Words under four letters must match exactly.
 */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  return commonPrefixLength(a, b) >= Math.max(4, shorter - 1);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
