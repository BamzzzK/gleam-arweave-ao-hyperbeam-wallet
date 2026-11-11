import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_MESSAGES } from "../packages/runtime/src/dispatch/methods";

const threatModel = readFileSync(join(import.meta.dirname, "THREAT_MODEL.md"), "utf8");

describe("docs/THREAT_MODEL.md", () => {
  // The site is the one sender besides dApps that can reach the wallet, so
  // every message it can send belongs in the attacker table.
  it.each(Object.keys(SITE_MESSAGES))("names site message %s", (type) => {
    expect(threatModel).toContain(`\`${type}\``);
  });
});
