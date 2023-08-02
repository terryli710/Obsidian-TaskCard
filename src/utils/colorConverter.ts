import { logger } from "../log";


type RGB = { r: number, g: number, b: number };
type RGBA = { r: number, g: number, b: number, a: number };
type HEX = `#${string}`;

type AvailableColor = RGB | RGBA | HEX;

export function hexToRgb(hex: HEX): RGB {
    if (!validHex(hex)) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function rgbToHex(rgb: RGB): HEX {
    if (!validRGB(rgb)) return null;
    const r = rgb.r.toString(16).padStart(2, '0');
    const g = rgb.g.toString(16).padStart(2, '0');
    const b = rgb.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

export function darkenRGBColor(rgb: RGB, darkenPercent: number): RGB {
    if (!validRGB(rgb)) return rgb;
    let factor = 1 - darkenPercent;
    if (factor < 0) factor = 0;
    return {
        r: Math.floor(rgb.r * factor),
        g: Math.floor(rgb.g * factor),
        b: Math.floor(rgb.b * factor)
            }
}

export function darkenHexColor(hex: HEX, darkenPercent: number): HEX {
    if (!validHex(hex)) return hex;
    const rgbColor = hexToRgb(hex);
    return rgbToHex(darkenRGBColor(rgbColor, darkenPercent));
}

function validRGB(rgb: RGB): boolean {
    try {
        return rgb.r >= 0 && rgb.g >= 0 && rgb.b >= 0;
    } catch (e) {
        return false;
    }
}


function validHex(hex: HEX): boolean {
    try {
        return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(hex);
    } catch (e) {
        return false;
    }
}

