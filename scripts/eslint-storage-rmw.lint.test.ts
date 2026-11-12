import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

// Loaded by a computed path so tsc does not type-check the untyped JS config.
const configPath = "../eslint.config.js";
const { default: config } = (await import(configPath)) as { default: { plugins?: Record<string, unknown> }[] };
const gleam = config.find((c) => c.plugins?.gleam)?.plugins?.gleam;

function lint(code: string): number {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tseslint.parser },
        plugins: { gleam: gleam as never },
        rules: { "gleam/no-storage-read-modify-write": "error" },
      },
    ],
    "handler.ts",
  ).length;
}

describe("gleam/no-storage-read-modify-write", () => {
  it("reports a write whose read happened in another function", () => {
    expect(
      lint(`class H {
        async load() { return this.storage.get(KEY); }
        async add(x) { const list = await this.load(); await this.storage.set(KEY, [...list, x]); }
      }`),
    ).toBe(1);
  });

  it("treats a read through a helper's parameter as a read of every key", () => {
    expect(
      lint(`class H {
        async load(key) { return this.storage.get(key); }
        async add(x) { await this.storage.set(KEY, [x]); }
      }`),
    ).toBe(1);
  });

  it("names a template key by its prefix and a local by what it holds", () => {
    expect(
      lint(`async function f(storage, id) {
        const key = \`\${PREFIX}\${id}\`;
        await storage.get(key);
      }
      async function g(storage, id) { await storage.set(\`\${PREFIX}\${id}\`, 1); }`),
    ).toBe(1);
  });

  it("treats a write through a helper's parameter as a write of every key", () => {
    expect(
      lint(`class H {
        async save(key, v) { await this.storage.set(key, v); }
        async read() { return this.storage.get(KEY); }
      }`),
    ).toBe(1);
  });

  it("allows writing a key the file never reads", () => {
    expect(lint(`async function f(storage) { await storage.get(A); await storage.set(B, 1); }`)).toBe(0);
  });
});
