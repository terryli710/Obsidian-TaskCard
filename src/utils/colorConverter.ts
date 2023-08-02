import { logger } from "../log";


type RGB = { r: number, g: number, b: number };
type RGBA = { r: number, g: number, b: number, a: number };
type HEX = `#${string}`;

type AvailableColor = RGB | RGBA | HEX;

export function hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function rgbToHex(rgb: RGB): HEX {
    return `#${rgb.r.toString(16)}${rgb.g.toString(16)}${rgb.b.toString(16)}`;
}

export function darkenRGBColor(rgb: RGB, darkenPercent: number): RGB {
    const factor = 1 - darkenPercent;
    return {
        r: Math.floor(rgb.r * factor),
        g: Math.floor(rgb.g * factor),
        b: Math.floor(rgb.b * factor)
            }
}

export function darkenHexColor(hex: HEX, darkenPercent: number): HEX {
    logger.debug(`hex: ${hex}`);
    const factor = 1 - darkenPercent;
    const rgbColor = hexToRgb(hex);
    return rgbToHex(darkenRGBColor(rgbColor, darkenPercent));
}
