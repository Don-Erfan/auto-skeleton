import { afterEach, describe, expect, it, vi } from 'vitest';
import { autoSkeleton } from '../src';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function card(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<img alt="" class="avatar"><h2>Ada Lovelace</h2><button>Follow</button>';
  document.body.appendChild(el);
  return el;
}

function fakeLayout(width: (el: Element) => number = (el) => (el.tagName === 'IMG' ? 64 : 300)) {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const w = width(this);
    return { left: 0, top: 0, right: w, bottom: w / 4, width: w, height: w / 4, x: 0, y: 0 } as DOMRect;
  });
}

describe('autoSkeleton (framework-free core)', () => {
  it('does nothing until started', () => {
    const el = card();
    const skeleton = autoSkeleton(el);
    expect(skeleton.active).toBe(false);
    expect(skeleton.element).toBe(el);
    expect(el.querySelector('[data-auto-skeleton-overlay]')).toBeNull();
    expect(el.hasAttribute('aria-busy')).toBe(false);
  });

  it('start() hides the content and draws the skeleton; stop() restores everything', () => {
    fakeLayout();
    const el = card();
    const skeleton = autoSkeleton(el, { blockClassName: 'blk' });
    skeleton.start();

    expect(skeleton.active).toBe(true);
    expect(el.getAttribute('data-auto-skeleton')).toBe('loading');
    expect(el.getAttribute('aria-busy')).toBe('true');
    // jsdom reports `position: static`, so the element is made a containing block.
    expect(el.style.position).toBe('relative');
    const overlay = el.lastElementChild as HTMLElement;
    expect(overlay.hasAttribute('data-auto-skeleton-overlay')).toBe(true);
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.querySelector('style')!.textContent).toContain('auto-skeleton-shimmer');
    for (const child of ['img', 'h2', 'button']) expect(el.querySelector(child)!.hasAttribute('inert')).toBe(true);

    const blocks = overlay.querySelectorAll('[data-auto-skeleton-block]');
    expect(blocks.length).toBe(skeleton.getBlocks().length);
    const img = Array.from(blocks).find((b) => (b as HTMLElement).style.width === '64px') as HTMLElement;
    expect(img.getAttribute('data-auto-skeleton-block')).toBe('block');
    expect(img.className).toBe('blk');

    skeleton.stop();
    expect(skeleton.active).toBe(false);
    expect(el.querySelector('[data-auto-skeleton-overlay]')).toBeNull();
    expect(el.hasAttribute('data-auto-skeleton')).toBe(false);
    expect(el.hasAttribute('aria-busy')).toBe(false);
    expect(el.style.position).toBe('');
    expect(el.querySelectorAll('[inert]')).toHaveLength(0);
    expect(skeleton.getBlocks()).toEqual([]);
  });

  it('keeps existing inline position and aria-busy values', () => {
    const el = card();
    el.style.position = 'absolute';
    el.setAttribute('aria-busy', 'false');
    const skeleton = autoSkeleton(el);
    skeleton.start();
    expect(el.style.position).toBe('absolute');
    skeleton.stop();
    expect(el.style.position).toBe('absolute');
    expect(el.getAttribute('aria-busy')).toBe('false');
  });

  it('start/stop are idempotent and setLoading toggles', () => {
    const el = card();
    const skeleton = autoSkeleton(el);
    skeleton.setLoading(true);
    skeleton.start();
    expect(el.querySelectorAll('[data-auto-skeleton-overlay]')).toHaveLength(1);
    skeleton.setLoading(false);
    skeleton.stop();
    expect(el.querySelectorAll('[data-auto-skeleton-overlay]')).toHaveLength(0);
  });

  it('update() applies options to a running skeleton', () => {
    fakeLayout();
    const el = card();
    const skeleton = autoSkeleton(el, { animation: 'pulse', baseColor: '#eee' });
    skeleton.start();
    const overlay = el.querySelector('[data-auto-skeleton-overlay]') as HTMLElement;
    expect(overlay.getAttribute('data-animation')).toBe('pulse');
    expect(overlay.style.getPropertyValue('--auto-skeleton-base')).toBe('#eee');

    skeleton.update({ baseColor: undefined, duration: '800ms', overlayClassName: 'ov', textRadius: 0 });
    expect(overlay.style.getPropertyValue('--auto-skeleton-base')).toBe('');
    expect(overlay.style.getPropertyValue('--auto-skeleton-duration')).toBe('800ms');
    expect(overlay.className).toBe('ov');
    expect(overlay.getAttribute('data-animation')).toBe('pulse');
  });

  it('re-measures automatically when the content changes, and on refresh()', async () => {
    let imageWidth = 64;
    fakeLayout((el) => (el.tagName === 'IMG' ? imageWidth : 300));
    const el = card();
    const skeleton = autoSkeleton(el);
    skeleton.start();
    const imageBlock = () => skeleton.getBlocks().find((b) => b.kind === 'block' && b.height === b.width / 4 && b.width !== 300);
    expect(imageBlock()!.width).toBe(64);

    imageWidth = 128;
    el.querySelector('img')!.setAttribute('src', 'data:,changed');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(imageBlock()!.width).toBe(128);

    imageWidth = 32;
    skeleton.refresh();
    expect(imageBlock()!.width).toBe(32);
  });

  it('cannot be restarted after destroy()', () => {
    const el = card();
    const skeleton = autoSkeleton(el);
    skeleton.start();
    skeleton.destroy();
    expect(el.querySelector('[data-auto-skeleton-overlay]')).toBeNull();
    skeleton.start();
    expect(skeleton.active).toBe(false);
    expect(el.querySelector('[data-auto-skeleton-overlay]')).toBeNull();
  });
});
