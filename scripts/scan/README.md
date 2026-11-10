# Scan CLI

This is the `pnpm scan` command that AI agents run during a community
security scan. It is the client side of a challenge-response protocol:
`start` fetches the challenge for one area of the surface, `finish`
validates the answers against the server before the user signs and
submits them, and `next` reports what the signed round earned and offers
the next area.
The full scan process is described in `SCANS.md`, and the agent's own
instructions are in `security/scan/SKILL.md`.

## Structure

- **`cli.ts`**: reads the command the agent typed and prints the result.
- **`start.ts`**: fetches a challenge from the points server, for the
  area named with `--area` or the one the server picks, lists that area's
  files and prepares the scan.
- **`finish.ts`**: checks the agent's report and answers with the points
  server, then prints the link where the user signs the attestation in
  their wallet.
- **`next.ts`**: after the user signs, asks the points server what the
  round earned and what the next one earns, moves the round's drafts
  aside, and prints the message that offers the next round.
- **`readability.ts`**: warns when a draft advisory in `.gleam-scan/` has
  a parser-style title, or is too long or too hard to read
  (`security/scan/REPORT.md`).
- **`api.ts`**: the calls to the points server.
- **`harness.ts`**, **`shared.ts`**: shared setup and types.

## Location

```text
        agent
          │ pnpm scan start
          ▼
      points-api      sends a challenge
          │
          ▼
        agent         scans and answers
          │ pnpm scan finish
          ▼
     attest.html      on gleamwallet.app
          │
          ▼
        wallet        user signs
          │
          ▼
      points-api      checks and rewards
          │ pnpm scan next
          ▼
        agent         offers the next area
```
