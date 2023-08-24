import { logger } from '../utils/log';

type RGB = { r: number; g: number; b: number };
type RGBA = { r: number; g: number; b: number; a: number };
type HSL = { h: number; s: number; l: number };
type HEX = `#${string}`;

type AvailableColor = RGB | RGBA | HEX;

export function HEXToRGB(HEX: HEX): RGB {
  if (!validHEX(HEX)) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(HEX);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}

export function RGBToHEX(RGB: RGB): HEX {
  if (!validRGB(RGB)) return null;
  const r = RGB.r.toString(16).padStart(2, '0');
  const g = RGB.g.toString(16).padStart(2, '0');
  const b = RGB.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function darkenRGBColor(RGB: RGB, darkenPercent: number): RGB {
  if (!validRGB(RGB)) return RGB;
  let factor = 1 - darkenPercent;
  if (factor < 0) factor = 0;
  return {
    r: Math.floor(RGB.r * factor),
    g: Math.floor(RGB.g * factor),
    b: Math.floor(RGB.b * factor)
  };
}

export function darkenHEXColor(HEX: HEX, darkenPercent: number): HEX {
  if (!validHEX(HEX)) return HEX;
  const RGBColor = HEXToRGB(HEX);
  return RGBToHEX(darkenRGBColor(RGBColor, darkenPercent));
}

function validRGB(RGB: RGB): boolean {
  try {
    return RGB.r >= 0 && RGB.g >= 0 && RGB.b >= 0;
  } catch (e) {
    return false;
  }
}

function validHEX(HEX: HEX): boolean {
  try {
    return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(HEX);
  } catch (e) {
    return false;
  }
}

export function stringToColor(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var color = '#';
  for (var i = 0; i < 3; i++) {
    var value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
}

export function stringToHSL(str: string, saturation = 50, lightness = 50): HSL {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = ((hash % 360) + 360) % 360; // Force hue to be a non-negative integer between 0 and 359

  return { h: hue, s: saturation, l: lightness };
}

export function HSLToRGB(HSL: HSL): RGB {
  let h = HSL.h / 360;
  let s = HSL.s / 100;
  let l = HSL.l / 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2RGB = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2RGB(p, q, h + 1 / 3);
    g = hue2RGB(p, q, h);
    b = hue2RGB(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

export function RGBToHSL(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}
