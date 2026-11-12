import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

// Loaded by a computed path so tsc does not type-check the untyped JS config.
const configPath = "../eslint.config.js";
const { default: config } = (await import(configPath)) as { default: { plugins?: Record<string, unknown> }[] };
const gleam = config.find((c) => c.plugins?.gleam)?.plugins?.gleam;

function lint(code: string): string[] {
  const linter = new Linter({ configType: "flat" });
  const messages = linter.verify(
    code,
    [
      {
        files: ["**/*.tsx"],
        languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { gleam: gleam as never },
        rules: { "gleam/untrusted-text": "error" },
      },
    ],
    "Card.tsx",
  );
  return messages.map((m) => m.message);
}

describe("gleam/untrusted-text", () => {
  it("rejects a bare token ticker child", () => {
    expect(lint("const a = <span>{token.ticker}</span>;")).toHaveLength(1);
  });
  it("rejects optional chains, tag values and the named paths", () => {
    expect(lint("const a = <p>{preview?.tokenTicker}</p>;")).toHaveLength(1);
    expect(lint("const a = <p>{tag.value}</p>;")).toHaveLength(1);
    expect(lint("const a = <p>{summary.text}{appInfo.name}</p>;")).toHaveLength(2);
  });
  it("allows the same inside UntrustedText", () => {
    expect(lint("const a = <UntrustedText text={token.ticker} />;")).toEqual([]);
    expect(lint("const a = <UntrustedText>{token.ticker}</UntrustedText>;")).toEqual([]);
  });
  it("allows the user's own labels", () => {
    expect(lint("const a = <p>{wallet.name}</p>;")).toEqual([]);
    expect(lint("const a = <p>{from.name}{contact.name}</p>;")).toEqual([]);
  });
  it("does not flag name or value on other objects", () => {
    expect(lint("const a = <p>{item.name}{input.value}</p>;")).toEqual([]);
  });
  it("does not check attribute values", () => {
    expect(lint("const a = <Row value={token.ticker} />;")).toEqual([]);
  });
});
