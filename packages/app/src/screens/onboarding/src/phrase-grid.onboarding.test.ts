import { describe, expect, it } from "vitest";
import { gridSizeFor, placeWords, resizeGrid } from "./phrase-grid";

const empty = (size: number) => Array<string>(size).fill("");
const twelve = "legal winner thank year wave sausage worth useful legal winner thank yellow";

describe("gridSizeFor", () => {
  it("rounds up to the next phrase length and caps at 24", () => {
    expect(gridSizeFor(1)).toBe(12);
    expect(gridSizeFor(12)).toBe(12);
    expect(gridSizeFor(13)).toBe(15);
    expect(gridSizeFor(22)).toBe(24);
    expect(gridSizeFor(30)).toBe(24);
  });
});

describe("placeWords", () => {
  it("fills the grid from the first cell when a whole phrase is pasted into any cell", () => {
    const update = placeWords(empty(12), 5, twelve);
    expect(update?.cells).toEqual(twelve.split(" "));
    expect(update?.foundCount).toBeUndefined();
    expect(update?.focus).toBe(11);
  });

  it("resizes the grid to fit a longer phrase", () => {
    const words = Array<string>(24).fill("abandon");
    expect(placeWords(empty(12), 0, words.join("\n"))?.cells).toHaveLength(24);
  });

  it("keeps every word of an off-length phrase and reports the count", () => {
    const update = placeWords(empty(12), 0, `${twelve} zoo`);
    expect(update?.cells).toEqual([...twelve.split(" "), "zoo", "", ""]);
    expect(update?.foundCount).toBe(13);
  });

  it("fills onward from the cell for a few words", () => {
    const update = placeWords(empty(12), 3, "thank year");
    expect(update?.cells.slice(2, 6)).toEqual(["", "thank", "year", ""]);
    expect(update?.focus).toBe(5);
  });

  it("grows the grid when a few words run past its end", () => {
    const update = placeWords(empty(12), 10, "one two three");
    expect(update?.cells).toHaveLength(15);
    expect(update?.cells.slice(10, 13)).toEqual(["one", "two", "three"]);
  });

  it("moves to the next cell after a typed word and separator", () => {
    const update = placeWords(empty(12), 0, "legal ");
    expect(update?.cells[0]).toBe("legal");
    expect(update?.focus).toBe(1);
  });

  it("ignores text with no words", () => {
    expect(placeWords(empty(12), 0, " , ")).toBeNull();
  });
});

describe("resizeGrid", () => {
  it("keeps the words that still fit", () => {
    expect(resizeGrid(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(resizeGrid(["a"], 3)).toEqual(["a", "", ""]);
  });
});
