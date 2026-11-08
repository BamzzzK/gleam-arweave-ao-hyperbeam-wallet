/**
 * Characters that render as nothing yet change what the text around them
 * looks like: bidi overrides and isolates (which can reorder `100.0` into
 * `0.001`), zero-width and other format characters, line separators, and
 * control codes other than tab, newline and carriage return.
 */
const HIDDEN_CHARACTER = /(?![\t\n\r])[\p{Cf}\p{Cc}\u2028\u2029]/gu;

export type TextPart = string | { codePoint: string };

/** Splits `text` into plain runs and the hidden characters between them, each named by its `U+` code point. */
export function escapeHiddenCharacters(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(HIDDEN_CHARACTER)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const hex = match[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
    parts.push({ codePoint: `U+${hex}` });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Site-supplied text on an approval screen, shown as exactly the characters
 * that are signed: hidden characters appear as `<U+XXXX>` instead of acting
 * on the layout, and the run is bidi-isolated so it cannot reorder the
 * labels beside it. Right-to-left letters still render normally.
 */
export function UntrustedText({ text }: { text: string }) {
  return (
    <bdi dir="ltr">
      {escapeHiddenCharacters(text).map((part, index) =>
        typeof part === "string" ? (
          part
        ) : (
          <span key={index} className="text-warning">{`<${part.codePoint}>`}</span>
        ),
      )}
    </bdi>
  );
}
