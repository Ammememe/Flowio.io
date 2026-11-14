import { tokenize } from '../match/text';

/** Word error rate: word-level edit distance divided by the length of the reference. 0 is perfect. */
export function wordErrorRate(reference: string, heard: string): number {
  const ref = tokenize(reference);
  const hyp = tokenize(heard);
  if (!ref.length) return hyp.length ? 1 : 0;
  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const row = [i];
    for (let j = 1; j <= hyp.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[hyp.length] / ref.length;
}
