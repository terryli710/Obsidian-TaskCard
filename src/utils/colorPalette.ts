import { HSLToRGB, RGBToHEX, stringToHSL } from "./colorConverter";

const HUSLColor15 = ['#f67088',
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
'#f569b7'];
/**
 * A stable palette color for a project name that isn't in the registry
 * (e.g. typed inline as [project:: Work]). Pure: the same name always gets
 * the same color, and nothing is registered or persisted (issue #8).
 */
export function paletteColorForName(name: string, palette: string[] = HUSLColor15): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (name.charCodeAt(i) + ((hash << 5) - hash)) | 0;
    }
    return palette[((hash % palette.length) + palette.length) % palette.length];
}

export class ColorPaletteManager {
    private colorPalette: string[];
    private usedColors: Set<string>;
    private lastAssignedIndex: number | null;

    constructor(initialColors: string[] = HUSLColor15) {
        this.colorPalette = initialColors;
        this.usedColors = new Set<string>();
        this.lastAssignedIndex = null;
    }

    assignColor(name: string): string {
        let startIndex = this.lastAssignedIndex !== null 
            ? (this.lastAssignedIndex + Math.floor(this.colorPalette.length / 2)) % this.colorPalette.length 
            : 0;

        for (let i = 0; i < this.colorPalette.length; i++) {
            const index = (startIndex + i) % this.colorPalette.length;
            const color = this.colorPalette[index];
            
            if (!this.usedColors.has(color)) {
                this.usedColors.add(color);
                this.lastAssignedIndex = index;
                return color;
            }
        }

        // All colors are used, handle this situation
        return this.stringToColor(name);
    }
    
    releaseColor(color: string): void {
        this.usedColors.delete(color);
    }

    // Optional: For generating random colors when palette is exhausted
    generateRandomColor(): string {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    stringToColor(str: string): string {
        return RGBToHEX(HSLToRGB(stringToHSL(str)))
    }
}
  