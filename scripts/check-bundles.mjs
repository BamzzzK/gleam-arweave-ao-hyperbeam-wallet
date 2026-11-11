#!/usr/bin/env node
// Checks the built extension (after `pnpm wxt:build`):
// - the keyring page, which holds unlocked keys, loads only key code;
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

/** Each page-injected file's size budget and the npm packages it may contain. */
export const PAGE_SCRIPTS = {
  "provider.js": { maxBytes: 16 * 1024, packages: ["wxt"] },
  "content-scripts/content.js": {
    maxBytes: 12 * 1024,
    packages: ["wxt", "@wxt-dev/browser", "@webext-core/messaging", "@aklinker1/zero-serialize-error"],
  },
};

/** The npm package a module path belongs to, or null for workspace code. */
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
  const seen = new Set();
  const queue = [entry];
  const modules = [];
  while (queue.length > 0) {
    const fileName = queue.pop();
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const chunk = chunks.get(fileName);
    if (!chunk) throw new Error(`no module map for ${fileName}; rebuild with pnpm wxt:build`);
    modules.push(...chunk.modules);
    queue.push(...chunk.imports, ...chunk.dynamicImports);
  }
  return { chunks: [...seen], modules };
}

/** Problems with the keyring page's modules. */
export function keyringProblems(modules) {
  return modules
    .filter((module) => !KEYRING_ALLOWED.some((pattern) => pattern.test(module)))
    .map((module) => `keyring page loads ${JSON.stringify(module)}, which isn't key code`);
}

/** Problems with one page-injected file. */
export function pageScriptProblems(fileName, bytes, modules) {
  const { maxBytes, packages } = PAGE_SCRIPTS[fileName];
  const problems = [];
  if (bytes > maxBytes) problems.push(`${fileName} is ${bytes} bytes, over its ${maxBytes}-byte budget`);
  for (const name of new Set(modules.map(packageOf).filter((name) => name !== null))) {
    if (!packages.includes(name)) problems.push(`${fileName} contains npm package ${name}`);
  }
  return problems;
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

  const html = readFileSync(join(out, "keyring.html"), "utf8");
  const scripts = [...html.matchAll(/<script[^>]*src="\/?([^"]+)"/g)].map((match) => match[1]);
  if (scripts.length === 0) throw new Error("keyring.html loads no script");
  const keyring = scripts.map((script) => closureOf(script, chunks));
  const problems = keyringProblems(keyring.flatMap(({ modules }) => modules));

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
