# Write an advisory or PR body

A maintainer reads your report first in a list of many. Write so they can
decide in one minute what it is and how bad it is. Put everything else in
a `<details>` block they open when they triage it.

## Advisory shape

Use these parts, in this order:

- **Summary**: two or three sentences on what is wrong.
- **Impact**: who is affected and what they lose. Give the severity and
  one line on why.
- **Steps**: numbered, six at most, from the attacker's access to the harm.
- **Fix** (optional): one line.
- `Attestation id: {{ATTESTATION_ID}}`
- A `<details><summary>Detail for the triager</summary>` block with:
  - the six-field table from `VERIFY.md` (Attacker, Entry, Control,
    Boundary, Harm, Evidence);
  - the `file:line` trace;
  - any test code;
  - at most one line on why it isn't a duplicate of a named earlier
    advisory.

## Style

- Write for a person, not for a parser.
- Above `<details>`, keep to about 200 words, at reading grade 8 to 9.
- One claim per sentence. Keep sentences under about 20 words.
- Use active voice and the present tense.
- Cut hedges and filler. Don't argue that it isn't by design.
- Say once whether it is demonstrated, traced or needs a browser check.

`pnpm scan finish` warns when a `.gleam-scan/advisory-*.md` draft has
more than 200 words above `<details>` or a reading grade above 10. The
warning never fails the scan. Shorten the draft and move on.

## Example advisory

This example is invented. It shows the shape, not a real bug.

```markdown
**Summary**: The signing approval shows only the first 16 tags of a data
item. A page can add a 17th tag that the user never sees. Gleam then signs
it.

**Impact**: Any user who approves a `signDataItem` request from a hostile
page. The page gets a signature on a tag the user didn't review, such as
an AO `Action` they would refuse. Medium: the preview lies, but the user
still has to approve.

**Steps**:

1. The user connects to a hostile page.
2. The page calls `signDataItem` with 16 harmless tags and a 17th
   `Action: Transfer` tag.
3. The approval window lists the first 16 tags.
4. The user clicks Approve.
5. Gleam signs the item with all 17 tags.

Demonstrated with a unit test.

**Fix**: Render every tag, and scroll the list.

Attestation id: {{ATTESTATION_ID}}

<details><summary>Detail for the triager</summary>

| Field | |
| --- | --- |
| Attacker | A malicious dApp page |
| Entry | `signDataItem` with 17 tags |
| Control | The approval preview |
| Boundary | A signature the user didn't review |
| Harm | A preview that lies |
| Evidence | Demonstrated: the test below |

Trace: the `file:line` steps from the page call to the preview.

Test: the throwaway test that shows the 17th tag is signed but not shown.

Not a duplicate of GHSA-xxxx-xxxx-xxxx, which covered tag values, not
tag count.

</details>
```

## PR body

Follow `.github/PULL_REQUEST_TEMPLATE.md`, in the same style:

- **Why**: one to three sentences on the problem the PR fixes.
- **What**: one to three sentences, or a short list, on the change.
- **Attestation id**: `Attestation id: {{ATTESTATION_ID}}`.
- **Checklist**: tick only what you ran.

Put any trace or long reasoning in a `<details>` block under **What**. A
PR never holds the details of a medium or higher issue.
