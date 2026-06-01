import type { GlbOptions } from '../core/gltf';

export interface ExportDialogController {
  open(): Promise<GlbOptions | null>;
}

const STEP = 0.05;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Modal export options. Uses the native <dialog> so focus trapping, Esc to
// cancel, and the backdrop come from the platform. The last-used settings are
// remembered for the session.
export function mountExportDialog(dialog: HTMLDialogElement): ExportDialogController {
  let lighting: 'unlit' | 'pbr' = 'unlit';
  let metallic = 0;
  let roughness = 1;

  const form = document.createElement('form');
  form.method = 'dialog';

  const title = document.createElement('h2');
  title.id = 'export-dialog-title';
  title.textContent = 'Export glTF';
  dialog.setAttribute('aria-labelledby', title.id);

  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Lighting';
  fieldset.appendChild(legend);

  function radio(value: 'unlit' | 'pbr', text: string): HTMLInputElement {
    const label = document.createElement('label');
    label.className = 'field-radio';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'lighting';
    input.value = value;
    label.append(input, document.createTextNode(text));
    fieldset.appendChild(label);
    return input;
  }
  const unlitRadio = radio('unlit', 'Unlit');
  const pbrRadio = radio('pbr', 'PBR');

  function rangeField(text: string): {
    wrap: HTMLElement;
    input: HTMLInputElement;
    out: HTMLOutputElement;
  } {
    const wrap = document.createElement('label');
    wrap.className = 'field-range';
    const name = document.createElement('span');
    name.textContent = text;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = String(STEP);
    const out = document.createElement('output');
    wrap.append(name, input, out);
    return { wrap, input, out };
  }
  const metallicField = rangeField('Metallic');
  const roughnessField = rangeField('Roughness');

  const buttons = document.createElement('menu');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.value = 'cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => dialog.close('cancel'));
  const exportBtn = document.createElement('button');
  exportBtn.type = 'submit';
  exportBtn.value = 'export';
  exportBtn.textContent = 'Export';
  buttons.append(cancelBtn, exportBtn);

  form.append(title, fieldset, metallicField.wrap, roughnessField.wrap, buttons);
  dialog.appendChild(form);

  function syncControls(): void {
    unlitRadio.checked = lighting === 'unlit';
    pbrRadio.checked = lighting === 'pbr';
    metallicField.input.value = String(metallic);
    roughnessField.input.value = String(roughness);
    metallicField.out.textContent = metallic.toFixed(2);
    roughnessField.out.textContent = roughness.toFixed(2);
    const lit = lighting === 'pbr';
    metallicField.input.disabled = !lit;
    roughnessField.input.disabled = !lit;
    metallicField.wrap.dataset.disabled = String(!lit);
    roughnessField.wrap.dataset.disabled = String(!lit);
  }

  unlitRadio.addEventListener('change', () => {
    if (unlitRadio.checked) lighting = 'unlit';
    syncControls();
  });
  pbrRadio.addEventListener('change', () => {
    if (pbrRadio.checked) lighting = 'pbr';
    syncControls();
  });
  metallicField.input.addEventListener('input', () => {
    metallic = clamp01(Number(metallicField.input.value));
    metallicField.out.textContent = metallic.toFixed(2);
  });
  roughnessField.input.addEventListener('input', () => {
    roughness = clamp01(Number(roughnessField.input.value));
    roughnessField.out.textContent = roughness.toFixed(2);
  });

  return {
    open(): Promise<GlbOptions | null> {
      syncControls();
      return new Promise((resolve) => {
        const onClose = (): void => {
          dialog.removeEventListener('close', onClose);
          if (dialog.returnValue !== 'export') {
            resolve(null);
            return;
          }
          resolve(
            lighting === 'pbr'
              ? { lighting, metallicFactor: metallic, roughnessFactor: roughness }
              : { lighting },
          );
        };
        dialog.addEventListener('close', onClose);
        dialog.returnValue = '';
        dialog.showModal();
      });
    },
  };
}
