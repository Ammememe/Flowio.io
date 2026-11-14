// P0-1 and P0-6: plain HTML slide, plus the one highlight animation (see style.css).
import type { Deck } from './deck';

export function renderSlide(stage: HTMLElement, deck: Deck, index: number): void {
  const slide = deck.slides[index];
  const kicker = document.createElement('div');
  kicker.className = 'slide-kicker';
  kicker.textContent = `${deck.title} · ${index + 1} / ${deck.slides.length}`;

  const title = document.createElement('h1');
  title.textContent = slide.title;

  const list = document.createElement('ul');
  list.className = 'bullets';
  slide.bullets.forEach((bullet, i) => {
    const item = document.createElement('li');
    item.dataset.id = bullet.id;
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(i + 1);
    const text = document.createElement('span');
    text.className = 'txt';
    text.textContent = bullet.text;
    item.append(num, text);
    list.append(item);
  });

  stage.replaceChildren(kicker, title, list);
}

/** The emphasis interface in miniature: one active bullet, or none. Phase 2 (P2-6) adds an intensity value. */
export function setActiveBullet(stage: HTMLElement, id: string | null): void {
  const list = stage.querySelector('.bullets');
  if (!list) return;
  list.classList.toggle('has-active', id !== null);
  for (const item of list.querySelectorAll<HTMLElement>('li')) {
    item.classList.toggle('active', item.dataset.id === id);
  }
}

/** Brief visual receipt for a ground-truth marker key press. */
export function flashMarker(stage: HTMLElement, id: string | null): void {
  const target = id ? stage.querySelector<HTMLElement>(`li[data-id="${id}"]`) : stage;
  if (!target) return;
  target.classList.remove('marked');
  void target.offsetWidth; // restart the animation
  target.classList.add('marked');
}
