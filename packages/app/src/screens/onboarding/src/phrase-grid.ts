import { MNEMONIC_WORD_COUNTS, splitPhrase } from "@gleam/core/src/keys/mnemonic.ts";

/** The grid a fresh import starts with: the length most wallets create. */
export const DEFAULT_GRID_SIZE = 12;

const MAX_GRID_SIZE = 24;

/** The smallest phrase length that fits `count` words, capped at 24. */
export function gridSizeFor(count: number): number {
  return MNEMONIC_WORD_COUNTS.find((size) => size >= count) ?? MAX_GRID_SIZE;
}

export interface GridUpdate {
  cells: string[];
  /** The cell to focus next. */
  focus: number;
  /**
   * Set when the text held a whole phrase of a length BIP-39 doesn't
   * define, so the screen can say how many words it found.
   */
  foundCount?: number;
}

/**
 * Places text entered into cell `at`, whether pasted or typed. One word
 * stays in that cell. A whole phrase (12 or more words) replaces the grid
 * from the first cell wherever it was pasted, since a phrase pasted into
 * cell 5 is still the phrase. Fewer words fill onward from `at`, growing
 * the grid if they run past its end. Returns null for text with no words.
 */
export function placeWords(cells: readonly string[], at: number, text: string): GridUpdate | null {
  const words = splitPhrase(text);
  if (words.length === 0) return null;

  if (words.length >= DEFAULT_GRID_SIZE) {
    const size = gridSizeFor(words.length);
    const placed = words.slice(0, size);
    const next = [...placed, ...Array<string>(size - placed.length).fill("")];
    const valid = (MNEMONIC_WORD_COUNTS as readonly number[]).includes(words.length);
    return {
      cells: next,
      focus: Math.min(placed.length, size - 1),
      ...(valid ? {} : { foundCount: words.length }),
    };
  }

  const size = Math.max(cells.length, gridSizeFor(at + words.length));
  const next = [...cells, ...Array<string>(size - cells.length).fill("")];
  words.forEach((word, offset) => {
    if (at + offset < size) next[at + offset] = word;
  });
  return { cells: next, focus: Math.min(at + words.length, size - 1) };
}

/** Resizes the grid, keeping the words that still fit. */
export function resizeGrid(cells: readonly string[], size: number): string[] {
  return Array.from({ length: size }, (_, index) => cells[index] ?? "");
}
