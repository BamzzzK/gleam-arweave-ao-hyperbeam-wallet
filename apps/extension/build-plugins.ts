import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The Vite plugin hooks used here; `vite` itself is WXT's dependency, not this package's. */
interface BuildPlugin {
  name: string;
  outputOptions?(options: { format?: string }): object | null;
  generateBundle?(options: unknown, bundle: Record<string, BundleOutput>): void;
}

type BundleOutput =
  | { type: 'asset' }
  | {
      type: 'chunk';
      fileName: string;
      isEntry: boolean;
      imports: string[];
      dynamicImports: string[];
      modules: Record<string, unknown>;
    };

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Where `recordBundleModules` writes, beside the build rather than in it. */
export const BUNDLE_MODULES_DIR = fileURLToPath(new URL('./.output/bundle-modules', import.meta.url));

/** A module id as a repo-relative path; virtual ids keep their prefix. */
function repoPath(id: string): string {
  return id.startsWith('\0') || !id.startsWith('/') ? id : relative(REPO_ROOT, id.split('?')[0]!);
}

/**
 * The modules the keyring page loads. They get a chunk of their own, so
 * the page never imports a chunk Rolldown shared out of other pages,
 * where a third-party module could sit next to the unlocked keys.
 * `scripts/check-bundles.mjs` checks the result.
 */
const KEYRING_MODULES = [
  /^apps\/extension\/(entrypoints|src)\/keyring\//,
  /^packages\/core\/src\/signer\//,
  /^packages\/core\/src\/vault\/(base64|signer|message-signing)\.ts$/,
  /^packages\/core\/src\/models\/(signing|wallet)\.ts$/,
  /^packages\/messaging\/src\/keyring-protocol\.ts$/,
  /node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?hash-wasm\//,
];

export function isolateKeyring(): BuildPlugin {
  return {
    name: 'gleam:isolate-keyring',
    outputOptions(options) {
      // The content script and provider build as single IIFE files.
      if (options.format !== 'es') return null;
      return {
        ...options,
        manualChunks: (id: string) => (KEYRING_MODULES.some((pattern) => pattern.test(repoPath(id))) ? 'keyring-deps' : undefined),
      };
    },
  };
}

/**
 * Writes each output chunk's modules and imports to
 * `.output/bundle-modules/<entries>.json`, one file per WXT build, for
 * `scripts/check-bundles.mjs`.
 */
export function recordBundleModules(): BuildPlugin {
  return {
    name: 'gleam:record-bundle-modules',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? [
              {
                fileName: output.fileName,
                isEntry: output.isEntry,
                imports: output.imports,
                dynamicImports: output.dynamicImports,
                modules: Object.keys(output.modules).map(repoPath),
              },
            ]
          : [],
      );
      const entries = chunks
        .filter((chunk) => chunk.isEntry)
        .map((chunk) => chunk.fileName.replace(/-[\w-]{8}(?=\.js$)/, '').replace(/[^a-z0-9]+/gi, '_'))
        .sort();
      mkdirSync(BUNDLE_MODULES_DIR, { recursive: true });
      writeFileSync(join(BUNDLE_MODULES_DIR, `${entries.join('+').slice(0, 120) || 'none'}.json`), JSON.stringify(chunks, null, 2));
    },
  };
}
