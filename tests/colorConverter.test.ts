import { darkenHexColor, darkenRGBColor, hexToRgb, rgbToHex } from "../src/utils/colorConverter";

describe("Color Conversion Utilities", () => {
    describe("hexToRgb", () => {
        it("should correctly convert hex to rgb", () => {
            const rgb = hexToRgb("#FFFFFF");
            expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
        });

        it("should return null for invalid hex code", () => {
            const rgb = hexToRgb("#GGGGGG");
            expect(rgb).toBeNull();
        });
    });

    describe("rgbToHex", () => {
        it("should correctly convert rgb to hex", () => {
            const hex = rgbToHex({ r: 255, g: 255, b: 255 });
            expect(hex).toEqual("#ffffff");
        });
    });

    describe("darkenRGBColor", () => {
        it("should darken the color correctly", () => {
            const rgb = darkenRGBColor({ r: 255, g: 255, b: 255 }, 0.5);
            expect(rgb).toEqual({ r: 127, g: 127, b: 127 });
        });

        it("should not darken beyond 0", () => {
            const rgb = darkenRGBColor({ r: 255, g: 255, b: 255 }, 1.5);
            expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
        });
    });

    describe("darkenHexColor", () => {
        it("should darken the color correctly", () => {
            const hex = darkenHexColor("#FFFFFF", 0.5);
            expect(hex).toEqual("#7f7f7f");
        });

        it("should not darken beyond 0", () => {
            const hex = darkenHexColor("#FFFFFF", 1.5);
            expect(hex).toEqual("#000000");
        });

        it("should return original color for invalid hex code", () => {
            const hex = darkenHexColor("#GGGGGG", 0.5);
            expect(hex).toEqual("#GGGGGG");
        });

        it("another test case for darken color", () => {
            const hex = darkenHexColor("#F6F6F6", 0.2);
            expect(hex).toEqual("#c4c4c4");
        });
    });
});