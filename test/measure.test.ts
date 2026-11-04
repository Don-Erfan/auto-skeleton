import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectSkeletonBlocks, isTransparentColor, sameBlocks } from '../src/measure';

type Rect = { left: number; top: number; width: number; height: number };

const rects = new WeakMap<Node, Rect[]>();

function domRect({ left, top, width, height }: Rect): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

/** jsdom has no layout engine, so tests assign boxes by hand. */
function layout(node: Node, ...boxes: Rect[]): void {
  rects.set(node, boxes);
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box = rects.get(this);
    return domRect(box ? box[0] : { left: 0, top: 0, width: 0, height: 0 });
  });
  let selected: Node | null = null;
  vi.spyOn(Range.prototype, 'selectNodeContents').mockImplementation(function (node: Node) {
    selected = node;
  });
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value() {
      const list = (selected && rects.get(selected)) || [];
      return list.map(domRect);
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  layout(root, { left: 100, top: 50, width: 400, height: 300 });
  return root;
}

describe('collectSkeletonBlocks', () => {
  it('turns text lines into text blocks relative to the root', () => {
    const root = mount('<p>Hello world</p>');
    const p = root.querySelector('p')!;
    layout(p, { left: 100, top: 50, width: 400, height: 40 });
    layout(p.firstChild!, { left: 100, top: 50, width: 120, height: 18 }, { left: 100, top: 70, width: 80, height: 18 });

    expect(collectSkeletonBlocks(root)).toEqual([
      { kind: 'text', x: 0, y: 0, width: 120, height: 18, radius: '' },
      { kind: 'text', x: 0, y: 20, width: 80, height: 18, radius: '' },
    ]);
  });

  it('merges fragments that sit next to each other on one line', () => {
    const root = mount('<p>Hello <b>world</b></p>');
    const p = root.querySelector('p')!;
    const b = root.querySelector('b')!;
    layout(p, { left: 100, top: 50, width: 400, height: 20 });
    layout(b, { left: 150, top: 50, width: 50, height: 18 });
    layout(p.firstChild!, { left: 100, top: 50, width: 48, height: 18 });
    layout(b.firstChild!, { left: 150, top: 50, width: 50, height: 18 });

    expect(collectSkeletonBlocks(root)).toEqual([{ kind: 'text', x: 0, y: 0, width: 100, height: 18, radius: '' }]);
    expect(collectSkeletonBlocks(root, { mergeText: false })).toHaveLength(2);
  });

  it('does not merge text that is far apart or on different lines', () => {
    const root = mount('<div><span>A</span><span>B</span><span>C</span></div>');
    const [a, b, c] = Array.from(root.querySelectorAll('span'));
    layout(root.firstElementChild!, { left: 100, top: 50, width: 400, height: 100 });
    layout(a.firstChild!, { left: 100, top: 50, width: 20, height: 18 });
    layout(b.firstChild!, { left: 300, top: 50, width: 20, height: 18 });
    layout(c.firstChild!, { left: 100, top: 90, width: 20, height: 18 });
    for (const el of [a, b, c]) layout(el, rects.get(el.firstChild!)![0]);

    expect(collectSkeletonBlocks(root)).toHaveLength(3);
  });

  it('draws media and controls as single blocks with their own border radius', () => {
    const root = mount(
      '<img style="border-radius: 50%" alt="avatar"><button style="border-radius: 8px">Follow <span>now</span></button>',
    );
    const img = root.querySelector('img')!;
    const button = root.querySelector('button')!;
    layout(img, { left: 110, top: 60, width: 64, height: 64 });
    layout(button, { left: 200, top: 60, width: 90, height: 32 });

    expect(collectSkeletonBlocks(root, { surfaces: false })).toEqual([
      { kind: 'block', x: 10, y: 10, width: 64, height: 64, radius: '50%' },
      { kind: 'block', x: 100, y: 10, width: 90, height: 32, radius: '8px' },
    ]);
  });

  it('draws empty painted boxes (e.g. avatar placeholders) as blocks', () => {
    const root = mount(
      '<div class="avatar" style="background-color: red; border-radius: 9999px"></div><div class="spacer"></div>',
    );
    layout(root.querySelector('.avatar')!, { left: 100, top: 50, width: 40, height: 40 });
    layout(root.querySelector('.spacer')!, { left: 100, top: 90, width: 400, height: 20 });

    expect(collectSkeletonBlocks(root)).toEqual([
      { kind: 'block', x: 0, y: 0, width: 40, height: 40, radius: '9999px' },
    ]);
  });

  it('keeps container backgrounds, borders and shadows as surfaces, drawn first', () => {
    const root = mount(
      '<div class="card" style="background-color: rgb(255, 255, 255); border: 1px solid rgb(0, 0, 0); border-radius: 12px; box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 8px 0px"><p>Title</p></div>',
    );
    const card = root.querySelector('.card')!;
    const p = root.querySelector('p')!;
    layout(card, { left: 100, top: 50, width: 300, height: 120 });
    layout(p, { left: 116, top: 66, width: 268, height: 20 });
    layout(p.firstChild!, { left: 116, top: 66, width: 50, height: 18 });

    const blocks = collectSkeletonBlocks(root);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'surface', x: 0, y: 0, width: 300, height: 120, radius: '12px' });
    expect(blocks[0].paint).toMatchObject({
      backgroundColor: 'rgb(255, 255, 255)',
      borderTop: '1px solid rgb(0, 0, 0)',
      borderLeft: '1px solid rgb(0, 0, 0)',
    });
    expect(blocks[0].paint!.boxShadow).toContain('rgba(0, 0, 0, 0.1)');
    expect(blocks[1]).toMatchObject({ kind: 'text', x: 16, y: 16 });

    expect(collectSkeletonBlocks(root, { surfaces: false }).map((b) => b.kind)).toEqual(['text']);
  });

  it('skips hidden, ignored and excluded subtrees', () => {
    const root = mount(
      '<p class="gone" style="display:none">x</p><p class="invisible" style="visibility:hidden">y</p><p data-skeleton-ignore>z</p><span class="overlay">o</span><script>var a</script>',
    );
    for (const el of Array.from(root.children)) {
      layout(el, { left: 100, top: 50, width: 10, height: 10 });
      if (el.firstChild) layout(el.firstChild, { left: 100, top: 50, width: 10, height: 10 });
    }
    expect(collectSkeletonBlocks(root, { exclude: root.querySelector('.overlay') })).toEqual([]);
  });

  it('shows visible children of a visibility:hidden parent', () => {
    const root = mount('<div style="visibility:hidden">hidden <span style="visibility:visible">shown</span></div>');
    const div = root.firstElementChild!;
    const span = root.querySelector('span')!;
    layout(div, { left: 100, top: 50, width: 200, height: 20 });
    layout(div.firstChild!, { left: 100, top: 50, width: 50, height: 18 });
    layout(span, { left: 300, top: 50, width: 40, height: 18 });
    layout(span.firstChild!, { left: 300, top: 50, width: 40, height: 18 });

    expect(collectSkeletonBlocks(root)).toEqual([{ kind: 'text', x: 200, y: 0, width: 40, height: 18, radius: '' }]);
  });

  it('turns any element marked with data-skeleton into one block', () => {
    const root = mount('<div data-skeleton><p>a</p><p>b</p></div>');
    layout(root.firstElementChild!, { left: 120, top: 70, width: 100, height: 60 });
    expect(collectSkeletonBlocks(root)).toEqual([{ kind: 'block', x: 20, y: 20, width: 100, height: 60, radius: '' }]);
  });

  it('clips blocks to ancestors with overflow hidden', () => {
    const root = mount('<div style="overflow:hidden"><img alt=""></div>');
    const box = root.firstElementChild!;
    layout(box, { left: 100, top: 50, width: 100, height: 100 });
    layout(root.querySelector('img')!, { left: 150, top: 100, width: 200, height: 200 });
    expect(collectSkeletonBlocks(root)).toEqual([{ kind: 'block', x: 50, y: 50, width: 50, height: 50, radius: '' }]);
  });

  it('ignores whitespace-only text and zero-sized boxes', () => {
    const root = mount('<p>   </p><img alt="">');
    layout(root.querySelector('p')!.firstChild!, { left: 100, top: 50, width: 10, height: 18 });
    expect(collectSkeletonBlocks(root)).toEqual([]);
  });
});

describe('isTransparentColor', () => {
  it.each([
    ['transparent', true],
    ['', true],
    ['rgba(0, 0, 0, 0)', true],
    ['rgb(0 0 0 / 0)', true],
    ['rgb(0 0 0 / 0%)', true],
    ['hsla(0, 0%, 0%, 0)', true],
    ['rgba(0, 0, 0, 0.5)', false],
    ['rgb(255, 255, 255)', false],
    ['red', false],
  ])('%s -> %s', (color, expected) => {
    expect(isTransparentColor(color)).toBe(expected);
  });
});

describe('sameBlocks', () => {
  it('compares blocks structurally', () => {
    const a = [{ kind: 'text' as const, x: 1, y: 2, width: 3, height: 4, radius: '' }];
    expect(sameBlocks(a, [{ ...a[0] }])).toBe(true);
    expect(sameBlocks(a, [{ ...a[0], x: 2 }])).toBe(false);
    expect(sameBlocks(a, [])).toBe(false);
  });
});
