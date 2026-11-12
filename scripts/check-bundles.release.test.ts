// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BUNDLE_PACKAGES,
  closureOf,
  entryPackageProblems,
  keyringProblems,
  LAZY_PACKAGES,
  lazyChunkProblems,
  lazyChunksOf,
  packageOf,
  pageScriptProblems,
} from "./check-bundles.mjs";

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

describe("entry package allowlists", () => {
  const allowed = BUNDLE_PACKAGES["passkey.html"];
  const modules = allowed.map((name) => `${PNPM}/${name}/index.js`);

  it("passes an entry that holds exactly its list", () => {
    expect(entryPackageProblems("passkey.html", modules)).toEqual([]);
  });

  it("flags a package outside the list", () => {
    expect(entryPackageProblems("passkey.html", [...modules, `${PNPM}/bs58check/index.js`])).toEqual([
      "passkey.html contains npm package bs58check, which isn't in its allowlist",
    ]);
  });

  it("flags a listed package that no longer appears", () => {
    expect(entryPackageProblems("passkey.html", modules.slice(1))).toEqual([
      `passkey.html no longer contains ${allowed[0]}; remove it from its allowlist`,
    ]);
  });
});

describe("lazy chunks", () => {
  const PANEL = "apps/extension/src/hardware/panels/keystone.ts";
  const lazyPackages = LAZY_PACKAGES["approval.html"]![PANEL]!;
  const lazyModules = [PANEL, ...lazyPackages.map((name) => `${PNPM}/${name}/index.js`)];
  const chunks = (dynamic: boolean) =>
    new Map([
      [
        "chunks/approval.js",
        {
          imports: dynamic ? ["chunks/react.js"] : ["chunks/react.js", "chunks/keystone.js"],
          dynamicImports: dynamic ? ["chunks/keystone.js"] : [],
          modules: ["apps/extension/entrypoints/approval/index.tsx"],
        },
      ],
      ["chunks/react.js", { imports: [], dynamicImports: [], modules: [`${PNPM}/react/index.js`] }],
      ["chunks/keystone.js", { imports: ["chunks/react.js"], dynamicImports: [], modules: lazyModules }],
    ]);

  it("leaves a listed dynamic import out of the entry and checks only the packages it adds", () => {
    const map = chunks(true);
    const lazy = lazyChunksOf("approval.html", map);
    expect([...lazy]).toEqual(["chunks/keystone.js"]);
    const { modules } = closureOf("chunks/approval.js", map, lazy);
    expect(modules).not.toContain(PANEL);
    expect(lazyChunkProblems("approval.html", modules, map)).toEqual([]);
  });

  it("flags the lazy chunk when the entry loads it up front", () => {
    const map = chunks(false);
    const { modules } = closureOf("chunks/approval.js", map, lazyChunksOf("approval.html", map));
    expect(lazyChunkProblems("approval.html", modules, map)).toEqual([
      `approval.html loads ${PANEL} up front; it must load only through import()`,
    ]);
  });

  it("flags a package the lazy chunk adds outside its list, and a missing chunk", () => {
    const map = chunks(true);
    map.get("chunks/keystone.js")!.modules.push(`${PNPM}/left-pad/index.js`);
    const { modules } = closureOf("chunks/approval.js", map, lazyChunksOf("approval.html", map));
    expect(lazyChunkProblems("approval.html", modules, map)).toEqual([
      `approval.html's lazy ${PANEL} contains npm package left-pad, which isn't in its allowlist`,
    ]);
    map.delete("chunks/keystone.js");
    expect(lazyChunkProblems("approval.html", [], map)).toEqual([`approval.html: no chunk holds ${PANEL}; remove it from LAZY_PACKAGES`]);
  });
});
