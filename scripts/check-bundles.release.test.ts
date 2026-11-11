// @vitest-environment node
import { describe, expect, it } from "vitest";
import { closureOf, keyringProblems, packageOf, pageScriptProblems } from "./check-bundles.mjs";

const PNPM = "node_modules/.pnpm/x@1.0.0/node_modules";

describe("packageOf", () => {
  it("names the innermost package, scoped or not", () => {
    expect(packageOf(`${PNPM}/@webext-core/messaging/dist/index.mjs`)).toBe("@webext-core/messaging");
    expect(packageOf(`${PNPM}/hash-wasm/dist/index.esm.js`)).toBe("hash-wasm");
    expect(packageOf("packages/core/src/signer/keys.ts")).toBeNull();
  });
});

describe("keyring page", () => {
  const chunks = new Map([
    ["chunks/keyring.js", { imports: ["chunks/shared.js"], dynamicImports: [], modules: ["apps/extension/entrypoints/keyring/main.ts"] }],
    ["chunks/shared.js", { imports: [], dynamicImports: [], modules: ["packages/core/src/signer/keyring.ts", `${PNPM}/buffer/index.js`] }],
  ]);

  it("follows shared chunks and flags a module that isn't key code", () => {
    const { chunks: loaded, modules } = closureOf("chunks/keyring.js", chunks);
    expect(loaded).toEqual(["chunks/keyring.js", "chunks/shared.js"]);
    expect(keyringProblems(modules)).toEqual([`keyring page loads ${JSON.stringify(`${PNPM}/buffer/index.js`)}, which isn't key code`]);
  });

  it("allows the signer, hash-wasm and WXT's browser re-export", () => {
    expect(
      keyringProblems([
        "packages/core/src/signer/envelope.ts",
        `${PNPM}/hash-wasm/dist/index.esm.js`,
        `${PNPM}/wxt/dist/browser.mjs`,
        "\0virtual:wxt-plugins?entrypoint=keyring",
      ]),
    ).toEqual([]);
  });

  it("refuses the core barrel and arweave-js", () => {
    expect(keyringProblems(["packages/core/src/index.ts", `${PNPM}/arweave/web/index.js`])).toHaveLength(2);
  });

  it("fails without a module map", () => {
    expect(() => closureOf("chunks/missing.js", chunks)).toThrow(/no module map/);
  });
});

describe("page scripts", () => {
  it("enforces provider.js's budget and package list", () => {
    expect(pageScriptProblems("provider.js", 10_000, ["packages/provider/src/index.ts", `${PNPM}/wxt/dist/x.mjs`])).toEqual([]);
    expect(pageScriptProblems("provider.js", 20_000, [`${PNPM}/buffer/index.js`])).toEqual([
      "provider.js is 20000 bytes, over its 16384-byte budget",
      "provider.js contains npm package buffer",
    ]);
  });
});
