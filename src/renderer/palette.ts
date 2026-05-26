import type { Model } from '../core/model';

const SLOT_COUNT = 16;

export interface PaletteController {
  getActiveSlot(): number;
}

export function mountPalette(
  container: HTMLElement,
  model: Model,
  initialSlot: number,
): PaletteController {
  let activeSlot = initialSlot;
  const swatches: HTMLButtonElement[] = [];
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    const o = slot * 4;
    const r = model.palette[o]!;
    const g = model.palette[o + 1]!;
    const b = model.palette[o + 2]!;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.backgroundColor = `rgb(${r},${g},${b})`;
    btn.setAttribute('aria-label', `Slot ${slot}`);
    btn.setAttribute('aria-pressed', slot === activeSlot ? 'true' : 'false');
    btn.addEventListener('click', () => {
      activeSlot = slot;
      for (const s of swatches) {
        s.setAttribute('aria-pressed', s === btn ? 'true' : 'false');
      }
    });
    container.appendChild(btn);
    swatches.push(btn);
  }
  return { getActiveSlot: () => activeSlot };
}
