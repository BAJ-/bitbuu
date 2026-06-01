// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mountExportDialog } from './exportDialog';

function setup() {
  const dialog = document.createElement('dialog');
  dialog.id = 'export-dialog';
  // jsdom does not implement showModal; Electron's Chromium does. The tests
  // drive the close event directly, so a no-op stand-in is enough.
  dialog.showModal = () => {
    dialog.open = true;
  };
  document.body.append(dialog);
  const controller = mountExportDialog(dialog);
  return { dialog, controller };
}

afterEach(() => {
  document.body.innerHTML = '';
});

function radios(dialog: HTMLDialogElement) {
  return {
    unlit: dialog.querySelector<HTMLInputElement>('input[value="unlit"]')!,
    pbr: dialog.querySelector<HTMLInputElement>('input[value="pbr"]')!,
  };
}

function ranges(dialog: HTMLDialogElement) {
  return dialog.querySelectorAll<HTMLInputElement>('input[type="range"]');
}

describe('mountExportDialog', () => {
  it('defaults to unlit with the range controls disabled', () => {
    const { dialog, controller } = setup();
    void controller.open();
    const { unlit, pbr } = radios(dialog);
    expect(unlit.checked).toBe(true);
    expect(pbr.checked).toBe(false);
    for (const r of ranges(dialog)) expect(r.disabled).toBe(true);
  });

  it('enables the range controls when PBR is selected', () => {
    const { dialog, controller } = setup();
    void controller.open();
    const { pbr } = radios(dialog);
    pbr.checked = true;
    pbr.dispatchEvent(new Event('change'));
    for (const r of ranges(dialog)) expect(r.disabled).toBe(false);
  });

  it('resolves with the unlit option when exported', async () => {
    const { dialog, controller } = setup();
    const pending = controller.open();
    dialog.returnValue = 'export';
    dialog.dispatchEvent(new Event('close'));
    await expect(pending).resolves.toEqual({ lighting: 'unlit' });
  });

  it('resolves with PBR factors when exported lit', async () => {
    const { dialog, controller } = setup();
    const pending = controller.open();
    const { pbr } = radios(dialog);
    pbr.checked = true;
    pbr.dispatchEvent(new Event('change'));
    const [metallic, roughness] = ranges(dialog);
    metallic!.value = '0.5';
    metallic!.dispatchEvent(new Event('input'));
    roughness!.value = '0.2';
    roughness!.dispatchEvent(new Event('input'));
    dialog.returnValue = 'export';
    dialog.dispatchEvent(new Event('close'));
    await expect(pending).resolves.toEqual({
      lighting: 'pbr',
      metallicFactor: 0.5,
      roughnessFactor: 0.2,
    });
  });

  it('resolves null when cancelled', async () => {
    const { dialog, controller } = setup();
    const pending = controller.open();
    dialog.returnValue = 'cancel';
    dialog.dispatchEvent(new Event('close'));
    await expect(pending).resolves.toBeNull();
  });

  it('remembers the last choice on the next open', async () => {
    const { dialog, controller } = setup();
    const first = controller.open();
    const { pbr } = radios(dialog);
    pbr.checked = true;
    pbr.dispatchEvent(new Event('change'));
    const [metallic] = ranges(dialog);
    metallic!.value = '0.35';
    metallic!.dispatchEvent(new Event('input'));
    dialog.returnValue = 'export';
    dialog.dispatchEvent(new Event('close'));
    await first;

    void controller.open();
    expect(radios(dialog).pbr.checked).toBe(true);
    expect(ranges(dialog)[0]!.value).toBe('0.35');
    expect(ranges(dialog)[0]!.disabled).toBe(false);
  });
});
