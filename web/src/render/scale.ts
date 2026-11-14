/**
 * P2-1: "a 16:9 slide that scales to any screen". The slide is laid out at
 * a fixed logical size and scaled with a CSS transform to fit whatever
 * container it's mounted in -- simpler and crisper than trying to make
 * every layout's CSS itself responsive.
 */

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720; // 16:9

/**
 * Keeps `stage` scaled and centred inside `container` at all times.
 * Returns a cleanup function that stops watching for resizes.
 */
export function fitStageToContainer(stage: HTMLElement, container: HTMLElement): () => void {
  function fit(): void {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    const scale = Math.min(w / STAGE_WIDTH, h / STAGE_HEIGHT);
    const left = (w - STAGE_WIDTH * scale) / 2;
    const top = (h - STAGE_HEIGHT * scale) / 2;
    stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  }

  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(container);
  window.addEventListener("resize", fit);

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", fit);
  };
}
