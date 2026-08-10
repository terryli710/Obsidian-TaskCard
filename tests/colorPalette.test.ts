import { ColorPaletteManager } from '../src/utils/colorPalette';
import { HSLToRGB, RGBToHEX, stringToHSL } from '../src/utils/colorConverter';

// The default HUSL palette baked into src/utils/colorPalette.ts, in order.
const HUSL15 = [
  '#f67088',
  '#f37932',
  '#ca9131',
  '#ad9c31',
  '#8ea531',
  '#4fb031',
  '#33b07a',
  '#34ad99',
  '#36abae',
  '#38a8c5',
  '#3ba3ec',
  '#9491f4',
  '#cc79f4',
  '#f45fe3',
  '#f569b7'
];

describe('ColorPaletteManager.assignColor', () => {
  it('assigns the first palette color to the first request', () => {
    const manager = new ColorPaletteManager();
    expect(manager.assignColor('alpha')).toBe(HUSL15[0]);
  });

  it('walks the palette with a deterministic half-palette stride', () => {
    const manager = new ColorPaletteManager();
    // stride = floor(15 / 2) = 7: indices 0, 7, 14, (14+7)%15=6
    const assigned = ['a', 'b', 'c', 'd'].map((n) => manager.assignColor(n));
    expect(assigned).toEqual([HUSL15[0], HUSL15[7], HUSL15[14], HUSL15[6]]);
  });

  it('hands out all 15 palette colors exactly once before falling back', () => {
    const manager = new ColorPaletteManager();
    const assigned = Array.from({ length: 15 }, (_, i) =>
      manager.assignColor(`project-${i}`)
    );
    expect(new Set(assigned).size).toBe(15);
    expect(assigned.slice().sort()).toEqual(HUSL15.slice().sort());
  });

  it('falls back to the name-derived color once the palette is exhausted', () => {
    const manager = new ColorPaletteManager();
    for (let i = 0; i < 15; i++) manager.assignColor(`project-${i}`);
    const overflow = manager.assignColor('overflow-project');
    expect(overflow).toBe(manager.stringToColor('overflow-project'));
    expect(overflow).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('reuses a released color instead of falling back', () => {
    const manager = new ColorPaletteManager();
    for (let i = 0; i < 15; i++) manager.assignColor(`project-${i}`);
    manager.releaseColor(HUSL15[0]);
    // the only free slot is the released one, regardless of stride position
    expect(manager.assignColor('replacement')).toBe(HUSL15[0]);
  });

  it('supports a custom palette and overflows deterministically', () => {
    const manager = new ColorPaletteManager(['#111111', '#222222']);
    expect(manager.assignColor('one')).toBe('#111111'); // index 0
    expect(manager.assignColor('two')).toBe('#222222'); // (0 + 1) % 2
    expect(manager.assignColor('three')).toBe(manager.stringToColor('three'));
  });
});

describe('ColorPaletteManager.stringToColor', () => {
  it('is deterministic and composed from the HSL string hash', () => {
    const manager = new ColorPaletteManager();
    const first = manager.stringToColor('My Project');
    const second = manager.stringToColor('My Project');
    expect(first).toBe(second);
    expect(first).toBe(RGBToHEX(HSLToRGB(stringToHSL('My Project'))));
    expect(first).toMatch(/^#[0-9a-f]{6}$/i);
    // different names hash to different hues (spot check)
    expect(manager.stringToColor('Another Project')).not.toBe(first);
  });
});

describe('ColorPaletteManager.generateRandomColor', () => {
  it('builds a 6-digit hex color from Math.random', () => {
    const manager = new ColorPaletteManager();
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(manager.generateRandomColor()).toBe('#000000');
    spy.mockReturnValue(0.999999);
    expect(manager.generateRandomColor()).toBe('#FFFFFF');
    spy.mockRestore();
    expect(manager.generateRandomColor()).toMatch(/^#[0-9A-F]{6}$/);
  });
});
