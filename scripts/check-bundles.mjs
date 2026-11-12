#!/usr/bin/env node
// @ts-check
// Checks the built extension (after `pnpm wxt:build`):
// - the keyring page, which holds unlocked keys, loads only key code;
// - the background worker and every other extension page pull in only the
//   npm packages listed per entry in BUNDLE_PACKAGES;
// - provider.js (run in every page's world) and the content script
//   (injected into every page) stay within their size budgets and pull in
//   no npm package beyond the ones listed here.
// Reads the chunk-to-module map `apps/extension/build-plugins.ts` writes.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";

/** Modules the keyring page may load, as repo-relative paths or virtual ids. */
export const KEYRING_ALLOWED = [
  /^apps\/extension\/(entrypoints|src)\/keyring\//,
  /^packages\/core\/src\/signer\//,
  /^packages\/core\/src\/vault\/(base64|signer|message-signing)\.ts$/,
  /^packages\/core\/src\/(models|ports)\//,
  /^packages\/messaging\/src\/keyring-protocol\.ts$/,
  // Argon2id for the vault envelope.
  /node_modules\/hash-wasm\//,
  // `browser.runtime`, a re-export of the `chrome` global.
  /node_modules\/wxt\/dist\/browser\.mjs$/,
  /node_modules\/@wxt-dev\/browser\//,
  /^\0?virtual:wxt-(html-)?plugins\?entrypoint=keyring$/,
  /^\0rolldown\/runtime/,
];

/**
 * Each page-injected file's size budget and the npm packages it may contain.
 * @type {Record<string, { maxBytes: number, packages: string[] }>}
 */
export const PAGE_SCRIPTS = {
  "provider.js": { maxBytes: 16 * 1024, packages: ["wxt"] },
  "content-scripts/content.js": {
    maxBytes: 12 * 1024,
    packages: ["wxt", "@wxt-dev/browser", "@webext-core/messaging", "@aklinker1/zero-serialize-error"],
  },
};

/**
 * The npm packages each other built entry may contain: the background worker
 * (dispatcher, signing) and every page that renders what a user approves or
 * sees. Adding a package is a reviewed change to this file. A package that no
 * longer appears fails the check too, so a list never holds more than the
 * bundle does.
 */
const POPUP_PACKAGES = [
  "@aklinker1/zero-serialize-error",
  "@dicebear/core",
  "@dicebear/styles",
  "@radix-ui/primitive",
  "@radix-ui/react-compose-refs",
  "@radix-ui/react-context",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dismissable-layer",
  "@radix-ui/react-focus-guards",
  "@radix-ui/react-focus-scope",
  "@radix-ui/react-id",
  "@radix-ui/react-portal",
  "@radix-ui/react-presence",
  "@radix-ui/react-primitive",
  "@radix-ui/react-slot",
  "@radix-ui/react-use-callback-ref",
  "@radix-ui/react-use-controllable-state",
  "@radix-ui/react-use-effect-event",
  "@radix-ui/react-use-layout-effect",
  "@tanstack/query-core",
  "@tanstack/query-persist-client-core",
  "@tanstack/react-query",
  "@webext-core/messaging",
  "@wxt-dev/browser",
  "aria-hidden",
  "arweave",
  "bignumber.js",
  "class-variance-authority",
  "clsx",
  "flag-icons",
  "get-nonce",
  "qr-code-styling",
  "react",
  "react-dom",
  "react-remove-scroll",
  "react-remove-scroll-bar",
  "react-style-singleton",
  "scheduler",
  "tailwind-merge",
  "tslib",
  "use-callback-ref",
  "use-sidecar",
  "vaul",
  "vite-plugin-node-polyfills",
  "wxt",
  "zod",
];

/** @type {Record<string, string[]>} */
export const BUNDLE_PACKAGES = {
  "background.js": [
    "@aklinker1/zero-serialize-error",
    "@webext-core/messaging",
    "@wxt-dev/browser",
    "@wxt-dev/storage",
    "arweave",
    "bignumber.js",
    "hash-wasm",
    "superlock",
    "vite-plugin-node-polyfills",
    "wxt",
    "zod",
  ],
  "approval.html": [
    "@aklinker1/zero-serialize-error",
    "@dicebear/core",
    "@dicebear/styles",
    "@keystonehq/alias-sampling",
    "@keystonehq/bc-ur-registry",
    "@keystonehq/bc-ur-registry-arweave",
    "@ngraveio/bc-ur",
    "@radix-ui/primitive",
    "@radix-ui/react-compose-refs",
    "@radix-ui/react-context",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dismissable-layer",
    "@radix-ui/react-focus-guards",
    "@radix-ui/react-focus-scope",
    "@radix-ui/react-id",
    "@radix-ui/react-portal",
    "@radix-ui/react-presence",
    "@radix-ui/react-primitive",
    "@radix-ui/react-slot",
    "@radix-ui/react-use-callback-ref",
    "@radix-ui/react-use-controllable-state",
    "@radix-ui/react-use-effect-event",
    "@radix-ui/react-use-layout-effect",
    "@tanstack/query-core",
    "@tanstack/react-query",
    "@webext-core/messaging",
    "@wxt-dev/browser",
    "aria-hidden",
    "arweave",
    "assert",
    "available-typed-arrays",
    "base-x",
    "base64-js",
    "bignumber.js",
    "bs58",
    "bs58check",
    "buffer",
    "call-bind",
    "call-bind-apply-helpers",
    "call-bound",
    "cbor-sync",
    "cipher-base",
    "class-variance-authority",
    "clsx",
    "core-util-is",
    "crc",
    "create-hash",
    "define-data-property",
    "define-properties",
    "dunder-proto",
    "es-define-property",
    "es-errors",
    "es-object-atoms",
    "events",
    "for-each",
    "generator-function",
    "get-intrinsic",
    "get-nonce",
    "get-proto",
    "gopd",
    "has-property-descriptors",
    "has-symbols",
    "has-tostringtag",
    "hash-base",
    "hasown",
    "ieee754",
    "inherits",
    "is-arguments",
    "is-callable",
    "is-generator-function",
    "is-nan",
    "is-regex",
    "is-typed-array",
    "isarray",
    "jsbi",
    "jsqr",
    "math-intrinsics",
    "md5.js",
    "object-is",
    "object-keys",
    "object.assign",
    "possible-typed-array-names",
    "process-nextick-args",
    "qr-code-styling",
    "qrcode-generator",
    "react",
    "react-dom",
    "react-remove-scroll",
    "react-remove-scroll-bar",
    "react-style-singleton",
    "readable-stream",
    "ripemd160",
    "safe-buffer",
    "safe-regex-test",
    "scheduler",
    "set-function-length",
    "sha.js",
    "stream-browserify",
    "string_decoder",
    "tailwind-merge",
    "to-buffer",
    "tslib",
    "typed-array-buffer",
    "use-callback-ref",
    "use-sidecar",
    "util",
    "util-deprecate",
    "uuid",
    "vaul",
    "vite-plugin-node-polyfills",
    "which-typed-array",
    "wxt",
    "zod",
  ],
  "connect.html": [
    "@aklinker1/zero-serialize-error",
    "@keystonehq/alias-sampling",
    "@keystonehq/bc-ur-registry",
    "@keystonehq/bc-ur-registry-arweave",
    "@ngraveio/bc-ur",
    "@radix-ui/react-compose-refs",
    "@radix-ui/react-slot",
    "@webext-core/messaging",
    "@wxt-dev/browser",
    "arweave",
    "assert",
    "available-typed-arrays",
    "base-x",
    "base64-js",
    "bignumber.js",
    "bs58",
    "bs58check",
    "buffer",
    "call-bind",
    "call-bind-apply-helpers",
    "call-bound",
    "cbor-sync",
    "cipher-base",
    "class-variance-authority",
    "clsx",
    "core-util-is",
    "crc",
    "create-hash",
    "define-data-property",
    "define-properties",
    "dunder-proto",
    "es-define-property",
    "es-errors",
    "es-object-atoms",
    "events",
    "for-each",
    "generator-function",
    "get-intrinsic",
    "get-proto",
    "gopd",
    "has-property-descriptors",
    "has-symbols",
    "has-tostringtag",
    "hash-base",
    "hasown",
    "ieee754",
    "inherits",
    "is-arguments",
    "is-callable",
    "is-generator-function",
    "is-nan",
    "is-regex",
    "is-typed-array",
    "isarray",
    "jsbi",
    "jsqr",
    "math-intrinsics",
    "md5.js",
    "object-is",
    "object-keys",
    "object.assign",
    "possible-typed-array-names",
    "process-nextick-args",
    "qrcode-generator",
    "react",
    "react-dom",
    "readable-stream",
    "ripemd160",
    "safe-buffer",
    "safe-regex-test",
    "scheduler",
    "set-function-length",
    "sha.js",
    "stream-browserify",
    "string_decoder",
    "tailwind-merge",
    "to-buffer",
    "tslib",
    "typed-array-buffer",
    "util",
    "util-deprecate",
    "uuid",
    "vite-plugin-node-polyfills",
    "which-typed-array",
    "wxt",
  ],
  "passkey.html": [
    "@aklinker1/zero-serialize-error",
    "@dicebear/core",
    "@dicebear/styles",
    "@radix-ui/react-compose-refs",
    "@radix-ui/react-slot",
    "@webext-core/messaging",
    "@wxt-dev/browser",
    "arweave",
    "bignumber.js",
    "class-variance-authority",
    "clsx",
    "react",
    "react-dom",
    "scheduler",
    "tailwind-merge",
    "tslib",
    "vite-plugin-node-polyfills",
    "wxt",
  ],
  "popup.html": POPUP_PACKAGES,
  "sidepanel.html": POPUP_PACKAGES,
};

/**
 * The npm package a module path belongs to, or null for workspace code.
 * @param {string} modulePath
 * @returns {string | null}
 */
export function packageOf(modulePath) {
  const match = /.*node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(modulePath);
  return match ? match[1] : null;
}

/**
 * Every chunk the entry loads, statically or dynamically, and the
 * modules in them.
 * @param {string} entry
 * @param {Map<string, { imports: string[], dynamicImports: string[], modules: string[] }>} chunks
 */
export function closureOf(entry, chunks) {
  /** @type {Set<string>} */
  const seen = new Set();
  const queue = [entry];
  /** @type {string[]} */
  const modules = [];
  while (queue.length > 0) {
    const fileName = /** @type {string} */ (queue.pop());
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const chunk = chunks.get(fileName);
    if (!chunk) throw new Error(`no module map for ${fileName}; rebuild with pnpm wxt:build`);
    modules.push(...chunk.modules);
    queue.push(...chunk.imports, ...chunk.dynamicImports);
  }
  return { chunks: [...seen], modules };
}

/**
 * Problems with the keyring page's modules.
 * @param {string[]} modules
 */
export function keyringProblems(modules) {
  return modules
    .filter((module) => !KEYRING_ALLOWED.some((pattern) => pattern.test(module)))
    .map((module) => `keyring page loads ${JSON.stringify(module)}, which isn't key code`);
}

/**
 * Problems with the npm packages one entry contains, in both directions.
 * @param {string} entry
 * @param {string[]} modules
 */
export function entryPackageProblems(entry, modules) {
  const allowed = BUNDLE_PACKAGES[entry];
  const found = new Set(modules.map(packageOf).filter((name) => name !== null));
  /** @type {string[]} */
  const problems = [];
  for (const name of [...found].sort()) {
    if (!allowed.includes(name)) problems.push(`${entry} contains npm package ${name}, which isn't in its allowlist`);
  }
  for (const name of allowed) {
    if (!found.has(name)) problems.push(`${entry} no longer contains ${name}; remove it from its allowlist`);
  }
  return problems;
}

/**
 * Problems with one page-injected file.
 * @param {string} fileName
 * @param {number} bytes
 * @param {string[]} modules
 */
export function pageScriptProblems(fileName, bytes, modules) {
  const { maxBytes, packages } = PAGE_SCRIPTS[fileName];
  /** @type {string[]} */
  const problems = [];
  if (bytes > maxBytes) problems.push(`${fileName} is ${bytes} bytes, over its ${maxBytes}-byte budget`);
  for (const name of new Set(modules.map(packageOf).filter((name) => name !== null))) {
    if (!packages.includes(name)) problems.push(`${fileName} contains npm package ${name}`);
  }
  return problems;
}

/**
 * The scripts an HTML entry loads.
 * @param {string} htmlPath
 */
function scriptsOf(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  const scripts = [...html.matchAll(/<script[^>]*src="\/?([^"]+)"/g)].map((match) => /** @type {string} */ (match[1]));
  if (scripts.length === 0) throw new Error(`${htmlPath} loads no script`);
  return scripts;
}

function main() {
  const extension = fileURLToPath(new URL("../apps/extension/.output/", import.meta.url));
  const out = join(extension, "chrome-mv3");
  const mapDir = join(extension, "bundle-modules");
  if (!existsSync(out) || !existsSync(mapDir)) throw new Error("no build found; run pnpm wxt:build first");

  const chunks = new Map(
    readdirSync(mapDir)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => JSON.parse(readFileSync(join(mapDir, name), "utf8")))
      .map((chunk) => [chunk.fileName, chunk]),
  );

  const scripts = scriptsOf(join(out, "keyring.html"));
  const keyring = scripts.map((script) => closureOf(script, chunks));
  const problems = keyringProblems(keyring.flatMap(({ modules }) => modules));

  for (const entry of Object.keys(BUNDLE_PACKAGES)) {
    const files = entry.endsWith(".html") ? scriptsOf(join(out, entry)) : [entry];
    const modules = files.flatMap((file) => closureOf(file, chunks).modules);
    problems.push(...entryPackageProblems(entry, modules));
  }

  for (const fileName of Object.keys(PAGE_SCRIPTS)) {
    const chunk = chunks.get(fileName);
    if (!chunk) throw new Error(`no module map for ${fileName}`);
    problems.push(...pageScriptProblems(fileName, statSync(join(out, fileName)).size, chunk.modules));
  }

  const chunkCount = keyring.reduce((count, { chunks: loaded }) => count + loaded.length, 0);
  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`::error::${problem}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `bundles ok: keyring loads ${chunkCount} chunk(s) of key code; ` +
      Object.keys(PAGE_SCRIPTS)
        .map((fileName) => `${fileName} ${statSync(join(out, fileName)).size} bytes`)
        .join(", ") +
      "\n",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
