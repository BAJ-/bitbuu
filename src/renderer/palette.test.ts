// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createModel } from '../core/model';
import { mountPalette } from './palette';

describe('mountPalette', () => {
  it('renders one button per palette slot with its colour', () => {
    const model = createModel(4, 4, 4);
    const container = document.createElement('div');
    mountPalette(container, model, 1);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(16);
    const o = 1 * 4;
    expect(buttons[0]!.style.backgroundColor).toBe(
      `rgb(${model.palette[o]}, ${model.palette[o + 1]}, ${model.palette[o + 2]})`,
    );
  });

  it('marks the initial slot as pressed and exposes it', () => {
    const model = createModel(4, 4, 4);
    const container = document.createElement('div');
    const palette = mountPalette(container, model, 5);
    expect(palette.getActiveSlot()).toBe(5);
    const buttons = container.querySelectorAll('button');
    expect(buttons[4]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('selects a slot on click and moves the pressed state', () => {
    const model = createModel(4, 4, 4);
    const container = document.createElement('div');
    const palette = mountPalette(container, model, 1);
    const buttons = container.querySelectorAll('button');
    buttons[6]!.click();
    expect(palette.getActiveSlot()).toBe(7);
    expect(buttons[6]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('refresh restyles swatches from the current palette bytes', () => {
    const model = createModel(4, 4, 4);
    const container = document.createElement('div');
    const palette = mountPalette(container, model, 1);
    const o = 1 * 4;
    model.palette[o] = 1;
    model.palette[o + 1] = 2;
    model.palette[o + 2] = 3;
    palette.refresh();
    const buttons = container.querySelectorAll('button');
    expect(buttons[0]!.style.backgroundColor).toBe('rgb(1, 2, 3)');
  });
});
