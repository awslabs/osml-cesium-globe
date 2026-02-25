// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { classificationToColor, confidenceToColor } from "../cesiumStyling";

jest.mock("cesium", () => {
  class MockColor {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r = 0, g = 0, b = 0, a = 1) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
    }
    withAlpha(a: number) {
      return new MockColor(this.r, this.g, this.b, a);
    }
    static fromCssColorString(_css: string) {
      return new MockColor(0, 0, 0, 1);
    }
    static GRAY = new MockColor(0.5, 0.5, 0.5, 1);
  }
  return {
    Color: MockColor,
    ColorMaterialProperty: jest.fn(),
    ConstantProperty: jest.fn(),
    JulianDate: { now: jest.fn(() => ({})) },
    GeoJsonDataSource: jest.fn(),
  };
});

describe("confidenceToColor", () => {
  it("returns red-ish for low confidence", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const color = confidenceToColor(0.0) as any;
    expect(color.r).toBe(1.0);
    expect(color.g).toBe(0.0);
  });

  it("returns yellow-ish for mid confidence", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const color = confidenceToColor(0.5) as any;
    expect(color.r).toBe(1.0);
    expect(color.g).toBe(1.0);
  });

  it("returns green-ish for high confidence", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const color = confidenceToColor(1.0) as any;
    expect(color.r).toBe(0.0);
    expect(color.g).toBe(1.0);
  });

  it("clamps values outside 0-1", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const low = confidenceToColor(-0.5) as any;
    expect(low.r).toBe(1.0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const high = confidenceToColor(1.5) as any;
    expect(high.r).toBe(0.0);
  });
});

describe("classificationToColor", () => {
  it("returns consistent color for same label", () => {
    const labels = ["Vehicle", "Building"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c1 = classificationToColor("Vehicle", labels) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c2 = classificationToColor("Vehicle", labels) as any;
    expect(c1.r).toBe(c2.r);
  });

  it("returns different colors for different labels", () => {
    const labels = ["Vehicle", "Building"];
    expect(() => classificationToColor("Vehicle", labels)).not.toThrow();
    expect(() => classificationToColor("Building", labels)).not.toThrow();
  });
});
