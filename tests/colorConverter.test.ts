import { darkenHEXColor, darkenRGBColor, HEXToRGB, RGBToHEX } from "../src/utils/colorConverter";

describe("Color Conversion Utilities", () => {
    describe("HEXToRGB", () => {
        it("should correctly convert HEX to RGB", () => {
            const RGB = HEXToRGB("#FFFFFF");
            expect(RGB).toEqual({ r: 255, g: 255, b: 255 });
        });

        it("should return null for invalid HEX code", () => {
            const RGB = HEXToRGB("#GGGGGG");
            expect(RGB).toBeNull();
        });
    });

    describe("RGBToHEX", () => {
        it("should correctly convert RGB to HEX", () => {
            const HEX = RGBToHEX({ r: 255, g: 255, b: 255 });
            expect(HEX).toEqual("#ffffff");
        });
    });

    describe("darkenRGBColor", () => {
        it("should darken the color correctly", () => {
            const RGB = darkenRGBColor({ r: 255, g: 255, b: 255 }, 0.5);
            expect(RGB).toEqual({ r: 127, g: 127, b: 127 });
        });

        it("should not darken beyond 0", () => {
            const RGB = darkenRGBColor({ r: 255, g: 255, b: 255 }, 1.5);
            expect(RGB).toEqual({ r: 0, g: 0, b: 0 });
        });
    });

    describe("darkenHEXColor", () => {
        it("should darken the color correctly", () => {
            const HEX = darkenHEXColor("#FFFFFF", 0.5);
            expect(HEX).toEqual("#7f7f7f");
        });

        it("should not darken beyond 0", () => {
            const HEX = darkenHEXColor("#FFFFFF", 1.5);
            expect(HEX).toEqual("#000000");
        });

        it("should return original color for invalid HEX code", () => {
            const HEX = darkenHEXColor("#GGGGGG", 0.5);
            expect(HEX).toEqual("#GGGGGG");
        });

        it("another test case for darken color", () => {
            const HEX = darkenHEXColor("#F6F6F6", 0.2);
            expect(HEX).toEqual("#c4c4c4");
        });
    });



});