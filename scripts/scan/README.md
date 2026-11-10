# Scan CLI

This is the `pnpm scan` command that AI agents run during a community
security scan. It is the client side of a challenge-response protocol.
A scan runs in rounds, one area of the surface each, and the user signs
every round at once at the end:

- `start` fetches the challenge for one area and writes its round folder.
- `finish` validates a round's answers with the server and offers the
  next round.
- `file` re-checks every waiting round and prints one link that signs
  them all.
- `next` records which rounds the user signed and offers the next round.

The full scan process is described in `SCANS.md`, and the agent's own
instructions are in `security/scan/SKILL.md`.

## Structure

- **`cli.ts`**: reads the command the agent typed and prints the result.
- **`start.ts`**: picks the least-covered free area (or the one named
  with `--area`), fetches its challenge, lists the area's files and
  writes `.gleam-scan/rounds/<area>/`.
- **`finish.ts`**: checks one round's answers and report locally and with
  the points server, marks the round waiting, and prints the round offer.
- **`file.ts`**: re-checks every waiting round and prints the sign
  request with one `attest.html` link for all of them.
- **`next.ts`**: asks the points server which waiting rounds are signed,
  records them, and prints the sign request for the rest or the next
  round offer.
- **`rounds.ts`**: the round folders' state, the area pick, and the
  closing messages.
- **`readability.ts`**: warns when a draft advisory in a round folder has
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
        agent         scans one area
          │ pnpm scan finish
          ▼
        agent         offers the next area ── "next" ──▶ start
          │ "file": pnpm scan file
          ▼
     attest.html      on gleamwallet.app
          │
          ▼
        wallet        user signs each round
          │
          ▼
      points-api      checks and rewards
          │ pnpm scan next
          ▼
        agent         files reports, offers the next area
```
