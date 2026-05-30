// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountMenu } from './menu';

function setup() {
  const toggle = document.createElement('button');
  toggle.setAttribute('aria-expanded', 'false');
  const drawer = document.createElement('div');
  document.body.append(toggle, drawer);
  return { toggle, drawer };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountMenu', () => {
  it('renders a button per action with label and optional shortcut', () => {
    const { toggle, drawer } = setup();
    mountMenu(toggle, drawer, [
      { label: 'New', shortcut: 'Cmd+N', onClick: () => {} },
      { label: 'About', onClick: () => {} },
    ]);
    const buttons = drawer.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.querySelector('.menu-shortcut')?.textContent).toBe('Cmd+N');
    expect(buttons[1]!.querySelector('.menu-shortcut')).toBeNull();
    expect(buttons[1]!.textContent).toBe('About');
  });

  it('toggle opens and closes the drawer with matching aria-expanded and inert', () => {
    const { toggle, drawer } = setup();
    mountMenu(toggle, drawer, [{ label: 'New', onClick: () => {} }]);

    toggle.click();
    expect(drawer.classList.contains('open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.hasAttribute('inert')).toBe(false);

    toggle.click();
    expect(drawer.classList.contains('open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(drawer.hasAttribute('inert')).toBe(true);
  });

  it('focuses the first action when opened', () => {
    const { toggle, drawer } = setup();
    mountMenu(toggle, drawer, [{ label: 'New', onClick: () => {} }]);
    toggle.click();
    expect(document.activeElement).toBe(drawer.querySelector('button'));
  });

  it('invokes the action and closes the drawer when an item is clicked', () => {
    const { toggle, drawer } = setup();
    const onClick = vi.fn();
    mountMenu(toggle, drawer, [{ label: 'New', onClick }]);
    toggle.click();
    drawer.querySelector('button')!.click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(drawer.classList.contains('open')).toBe(false);
  });

  it('closes on outside pointerdown but not on inside pointerdown', () => {
    const { toggle, drawer } = setup();
    mountMenu(toggle, drawer, [{ label: 'New', onClick: () => {} }]);
    toggle.click();

    drawer.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(drawer.classList.contains('open')).toBe(true);

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(drawer.classList.contains('open')).toBe(false);
  });

  it('closes on Escape', () => {
    const { toggle, drawer } = setup();
    mountMenu(toggle, drawer, [{ label: 'New', onClick: () => {} }]);
    toggle.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(drawer.classList.contains('open')).toBe(false);
  });
});
