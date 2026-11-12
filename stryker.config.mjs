// @ts-check
/**
 * Mutation testing for the code where a test that passes by luck costs the
 * most: the key vault and signer, the signing pipelines, and the dispatch
 * table. `.github/workflows/mutation.yml` runs it weekly and fails below
 * `thresholds.break`. Locally: `pnpm exec stryker run` (in place, so
 * commit or stash first; it restores every file when it ends).
 *
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export default {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  vitest: { configFile: "vitest.config.ts", related: true },
  mutate: [
    "packages/core/src/signer/**/*.ts",
    "packages/core/src/vault/**/*.ts",
    "packages/runtime/src/dispatch/**/*.ts",
    "!**/*.test.ts",
    "!**/index.ts",
    // A word list: its mutants are string literals, and the policy logic is in password-policy.ts.
    "!packages/core/src/vault/common-passwords.ts",
  ],
  // pnpm links each package's dependencies inside the package, which a
  // sandbox copy leaves behind, so mutants are written in place.
  inPlace: true,
  // Vitest doesn't typecheck, so source files need no `@ts-nocheck`.
  disableTypeChecks: false,
  coverageAnalysis: "perTest",
  ignoreStatic: true,
  timeoutMS: 30_000,
  // The first run measures per-test coverage over every related suite,
  // which takes longer than the 5-minute default.
  dryRunTimeoutMinutes: 30,
  reporters: ["clear-text", "html", "progress"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  thresholds: { high: 90, low: 80, break: 85 },
};
