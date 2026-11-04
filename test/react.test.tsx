import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AutoSkeletonDefault, { AutoSkeleton } from '../src/react';

afterEach(cleanup);

function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      count {count}
    </button>
  );
}

describe('<AutoSkeleton>', () => {
  it('renders children untouched when not loading', () => {
    const { container } = render(
      <AutoSkeleton loading={false}>
        <p>Hello</p>
      </AutoSkeleton>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('DIV');
    expect(root.textContent).toBe('Hello');
    expect(root.hasAttribute('data-auto-skeleton')).toBe(false);
    expect(root.hasAttribute('aria-busy')).toBe(false);
    expect(root.querySelector('[data-auto-skeleton-overlay]')).toBeNull();
    expect(root.style.position).toBe('relative');
    expect(root.hasAttribute('data-auto-skeleton-ssr')).toBe(false);
    expect(root.querySelector('style')).toBeNull();
  });

  it('hides the content and renders an overlay while loading', () => {
    const { container } = render(
      <AutoSkeleton loading>
        <p>Hello</p>
        <span>World</span>
      </AutoSkeleton>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-auto-skeleton')).toBe('loading');
    expect(root.getAttribute('aria-busy')).toBe('true');
    // The server-rendering fallback is gone once the client has taken over.
    expect(root.hasAttribute('data-auto-skeleton-ssr')).toBe(false);
    expect(root.querySelectorAll('style')).toHaveLength(1);

    const overlay = root.querySelector('[data-auto-skeleton-overlay]') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.getAttribute('data-animation')).toBe('shimmer');
    expect(overlay.querySelector('style')!.textContent).toContain('auto-skeleton-shimmer');
    expect(root.lastElementChild).toBe(overlay);

    // Hidden content is removed from the tab order / accessibility tree.
    expect(root.querySelector('p')!.hasAttribute('inert')).toBe(true);
    expect(root.querySelector('span')!.hasAttribute('inert')).toBe(true);
    expect(overlay.hasAttribute('inert')).toBe(false);
  });

  it('keeps child state when loading toggles (no remount) and restores inert', () => {
    const { container, rerender } = render(
      <AutoSkeleton loading={false}>
        <Counter />
      </AutoSkeleton>,
    );
    const button = container.querySelector('button')!;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.textContent).toBe('count 2');

    rerender(
      <AutoSkeleton loading>
        <Counter />
      </AutoSkeleton>,
    );
    expect(container.querySelector('button')).toBe(button);
    expect(button.hasAttribute('inert')).toBe(true);

    rerender(
      <AutoSkeleton loading={false}>
        <Counter />
      </AutoSkeleton>,
    );
    expect(container.querySelector('button')).toBe(button);
    expect(button.textContent).toBe('count 2');
    expect(button.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('[data-auto-skeleton-overlay]')).toBeNull();
    expect(container.firstElementChild!.hasAttribute('data-auto-skeleton')).toBe(false);
    expect(container.firstElementChild!.hasAttribute('aria-busy')).toBe(false);
  });

  it('does not remove an inert attribute it did not add', () => {
    const markInert = (node: HTMLDivElement | null) => node?.setAttribute('inert', '');
    const { container, rerender } = render(
      <AutoSkeleton loading={false}>
        <div ref={markInert} className="own" />
      </AutoSkeleton>,
    );
    rerender(
      <AutoSkeleton loading>
        <div ref={markInert} className="own" />
      </AutoSkeleton>,
    );
    rerender(
      <AutoSkeleton loading={false}>
        <div ref={markInert} className="own" />
      </AutoSkeleton>,
    );
    expect(container.querySelector('.own')!.hasAttribute('inert')).toBe(true);
  });

  it('forwards refs, html attributes and the `as` element', () => {
    const ref = React.createRef<HTMLElement>();
    const { container } = render(
      <AutoSkeleton
        ref={ref}
        as="section"
        loading={false}
        id="profile"
        className="card"
        data-testid="x"
        style={{ marginTop: 4 }}
      >
        content
      </AutoSkeleton>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(ref.current).toBe(root);
    expect(root.tagName).toBe('SECTION');
    expect(root.id).toBe('profile');
    expect(root.className).toBe('card');
    expect(root.getAttribute('data-testid')).toBe('x');
    expect(root.style.marginTop).toBe('4px');
  });

  it('supports callback refs', () => {
    const ref = vi.fn();
    render(
      <AutoSkeleton ref={ref} loading>
        x
      </AutoSkeleton>,
    );
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('applies theme props as CSS variables', () => {
    const { container } = render(
      <AutoSkeleton loading animation="pulse" baseColor="#eee" highlightColor="#fff" duration={2} overlayClassName="ov">
        x
      </AutoSkeleton>,
    );
    const overlay = container.querySelector('[data-auto-skeleton-overlay]') as HTMLElement;
    expect(overlay.getAttribute('data-animation')).toBe('pulse');
    expect(overlay.className).toBe('ov');
    expect(overlay.style.getPropertyValue('--auto-skeleton-base')).toBe('#eee');
    expect(overlay.style.getPropertyValue('--auto-skeleton-highlight')).toBe('#fff');
    expect(overlay.style.getPropertyValue('--auto-skeleton-duration')).toBe('2s');
  });

  it('applies changed props while loading', () => {
    const { container, rerender } = render(
      <AutoSkeleton loading baseColor="#eee">
        x
      </AutoSkeleton>,
    );
    rerender(
      <AutoSkeleton loading baseColor="#ddd" animation="none">
        x
      </AutoSkeleton>,
    );
    const overlay = container.querySelector('[data-auto-skeleton-overlay]') as HTMLElement;
    expect(overlay.style.getPropertyValue('--auto-skeleton-base')).toBe('#ddd');
    expect(overlay.getAttribute('data-animation')).toBe('none');
  });

  it('keeps a user-provided aria-busy', () => {
    const { container, rerender } = render(
      <AutoSkeleton loading aria-busy="false">
        x
      </AutoSkeleton>,
    );
    expect(container.firstElementChild!.getAttribute('aria-busy')).toBe('true');
    rerender(
      <AutoSkeleton loading={false} aria-busy="false">
        x
      </AutoSkeleton>,
    );
    expect(container.firstElementChild!.getAttribute('aria-busy')).toBe('false');
  });

  it('cleans up on unmount', () => {
    const outer = document.createElement('div');
    document.body.appendChild(outer);
    const { unmount } = render(
      <AutoSkeleton loading>
        <p>x</p>
      </AutoSkeleton>,
      { container: outer },
    );
    unmount();
    expect(outer.innerHTML).toBe('');
  });

  it('renders measured blocks', () => {
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const size = this.tagName === 'IMG' ? 48 : 200;
      return { left: 0, top: 0, right: size, bottom: size, width: size, height: size, x: 0, y: 0 } as DOMRect;
    });
    const { container } = render(
      <AutoSkeleton loading blockClassName="blk">
        <img alt="" style={{ borderRadius: '50%' }} />
      </AutoSkeleton>,
    );
    const blocks = container.querySelectorAll('[data-auto-skeleton-block]');
    expect(blocks).toHaveLength(1);
    const block = blocks[0] as HTMLElement;
    expect(block.getAttribute('data-auto-skeleton-block')).toBe('block');
    expect(block.className).toBe('blk');
    expect(block.style.width).toBe('48px');
    expect(block.style.height).toBe('48px');
    expect(block.style.borderRadius).toBe('50%');
    spy.mockRestore();
  });

  it('re-measures when the content changes', async () => {
    function Dynamic({ wide }: { wide: boolean }) {
      return <img alt="" data-wide={wide ? 'yes' : 'no'} />;
    }
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const width = this.getAttribute('data-wide') === 'yes' ? 300 : this.tagName === 'IMG' ? 100 : 500;
      return { left: 0, top: 0, right: width, bottom: 20, width, height: 20, x: 0, y: 0 } as DOMRect;
    });
    const { container, rerender } = render(
      <AutoSkeleton loading>
        <Dynamic wide={false} />
      </AutoSkeleton>,
    );
    const width = () => (container.querySelector('[data-auto-skeleton-block]') as HTMLElement).style.width;
    expect(width()).toBe('100px');

    rerender(
      <AutoSkeleton loading>
        <Dynamic wide />
      </AutoSkeleton>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(width()).toBe('300px');
    spy.mockRestore();
  });

  it('exports the component as default too', () => {
    expect(AutoSkeletonDefault).toBe(AutoSkeleton);
  });

  it('hides the content in server-rendered HTML until the client takes over', () => {
    const html = renderToString(
      <AutoSkeleton loading>
        <p>Hello</p>
      </AutoSkeleton>,
    );
    expect(html).toContain('data-auto-skeleton-ssr=""');
    expect(html).toContain('<p>Hello</p>');
    // The CSS must not be HTML-escaped (it uses the `>` combinator).
    expect(html).toContain('[data-auto-skeleton-ssr]>:not(style){opacity:0!important');

    const loaded = renderToString(<AutoSkeleton loading={false}>Hello</AutoSkeleton>);
    expect(loaded).toBe('<div style="position:relative">Hello</div>');
  });
});
