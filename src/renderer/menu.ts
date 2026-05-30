export interface MenuAction {
  label: string;
  shortcut?: string;
  onClick: () => void;
}

export function mountMenu(
  toggle: HTMLButtonElement,
  drawer: HTMLElement,
  actions: ReadonlyArray<MenuAction>,
): () => void {
  function setOpen(open: boolean): void {
    const wasOpen = drawer.classList.contains('open');
    if (open === wasOpen) return;
    if (!open && drawer.contains(document.activeElement)) {
      toggle.focus();
    }
    drawer.classList.toggle('open', open);
    drawer.toggleAttribute('inert', !open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      const firstBtn = drawer.querySelector('button');
      if (firstBtn instanceof HTMLElement) firstBtn.focus();
    }
  }

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-action';
    const label = document.createElement('span');
    label.textContent = action.label;
    btn.appendChild(label);
    if (action.shortcut) {
      const sc = document.createElement('span');
      sc.className = 'menu-shortcut';
      sc.textContent = action.shortcut;
      btn.appendChild(sc);
    }
    btn.addEventListener('click', () => {
      setOpen(false);
      action.onClick();
    });
    drawer.appendChild(btn);
  }

  toggle.addEventListener('click', () => {
    setOpen(!drawer.classList.contains('open'));
  });

  function onDocumentPointerDown(e: PointerEvent): void {
    if (!drawer.classList.contains('open')) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (drawer.contains(target) || toggle.contains(target)) return;
    setOpen(false);
  }

  function onWindowKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      setOpen(false);
    }
  }

  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('keydown', onWindowKeyDown);

  return () => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('keydown', onWindowKeyDown);
  };
}
