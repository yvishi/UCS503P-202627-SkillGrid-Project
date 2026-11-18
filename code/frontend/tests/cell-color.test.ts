import { describe, expect, it } from "vitest";
import { cellStyle, type CellLevel } from "@/app/ui/cell-color";

describe("cellStyle", () => {
  it("fills evidence cells", () => {
    expect(cellStyle(3, false)).toEqual({ backgroundColor: "var(--cell-3)" });
  });
  it("draws level 0 the same for both kinds", () => {
    expect(cellStyle(0, true)).toEqual(cellStyle(0, false));
  });
  it("outlines self cells and never fills them", () => {
    const s = cellStyle(4, true);
    expect(s.backgroundColor).toBeUndefined();
    expect(s.boxShadow).toContain("inset");
  });
  it("grows the inner mark with the self level", () => {
    const size = (l: CellLevel) => parseInt(String(cellStyle(l, true).backgroundSize));
    expect(size(1)).toBeLessThan(size(2));
    expect(size(2)).toBeLessThan(size(3));
    expect(size(3)).toBeLessThan(size(4));
    expect(size(4)).toBeLessThanOrEqual(60);
  });
});
