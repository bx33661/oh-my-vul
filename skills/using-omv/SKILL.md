---
name: using-omv
description: |
  Bootstrap discipline for oh-my-vul research. Use at the start of any vulnerability research conversation, when the user asks to audit/find/report a package, dig for CVEs, or run omv skills — and before claiming a finding is confirmed, ready to submit, or “done”. Establishes mandatory process, hard gates, and evidence-before-claims rules. Prefer this over improvising a research workflow.
---

# using-omv

High-quality growth rule for this project: **deepen discipline, do not inflate skill count.**

This skill is the session bootstrap. Domain work still lives in the `omv-find`, `omv-audit`, `omv-repro`, and `omv-report` skills. You use those skills **inside** the process below — you do not invent parallel workflows.

## Platform Invocation

Use the invocation form provided by the active agent:

| Platform | Project manager | Focused skill example |
|---|---|---|
| Pi | `/skill:omv` | `/skill:omv-audit <id>` |
| Codex | `$omv` | `$omv-audit <id>` |
| Claude Code | `/omv` | `/omv-audit <id>` |

In the workflow below, `/omv-*` is shorthand for the matching focused skill on the active platform.

## Iron Laws

```text
1. EVIDENCE BEFORE CLAIMS
2. CLI TRUTH BEFORE PROSE
3. PROCESS BEFORE IMPROVISATION
4. PASSIVE RESEARCH ONLY
```

<HARD-GATE>
Before any research claim or lifecycle transition, you must satisfy the matching gate.
Rationalizing past a gate is a failure mode, not speed.
</HARD-GATE>

## When This Applies

Invoke **before** substantive research action if the user is:

- looking for packages to audit, ranking targets, or running `/omv-find`
- auditing source → sink → guard, or running `/omv-audit`
- reproducing, reporting, disclosing, or asking “what next”
- about to say a finding is confirmed, report-ready, non-duplicate, or complete

If you are a subagent doing one delegated slice (e.g. only CVSS math), stay in that slice and still refuse to invent evidence.

## Default Research Pipeline

Use this order unless the user already has a later-stage artifact and explicitly continues from it:

```text
1. Orient
   omv dashboard  OR  /omv next
   If no campaign and user has a target → omv start / campaign init

2. Open the problem (开题) — prefer Attack Surface Cards when a campaign exists
   omv campaign surfaces propose <id>
   omv campaign surfaces select <id> --cards <id,id>
   omv campaign seed <id>
   (If no surfaces file, seed uses generic lanes — still candidate-only.)

3. Deepen one hypothesis at a time
   /omv-audit <id>     → fill Evidence; never invent file:line
   /omv-repro <id>     → only when observed_result is the blocker
   omv findings validate <id> after material edits

4. Gate before report language
   omv review <id> --strict
   Optional: /omv-critic <id>, /omv-dedup <id>

5. Report only when ready
   /omv-report <id> only if review says ready (or user overrides with explicit draft-only ask)
   Then provenance / archive only if user wants lifecycle bookkeeping
```

Announce briefly when you switch stages, e.g. “Using attack-surface cards to open the campaign” or “Running `omv review --strict` before any submit language.”

## Hard Gates (non-negotiable)

| Claim or action | Required evidence (fresh in this turn when possible) |
|---|---|
| Start multi-hypothesis audit on a target | Campaign exists; prefer surfaces propose/select before bulk seed |
| `status: confirmed` | `omv findings validate <id>` OK; source/sink/guard with concrete refs; submission score ≥ 75; no unresolved blockers |
| “Exploit works” / `exploitability: proven` | Local `observed_result` not `unknown`, or user-supplied observation recorded into Evidence |
| “Ready to submit” / submission-ready report | `omv review <id> --strict` → `ready` (or user explicitly asks for draft-only triage) |
| “Not a duplicate” | Dedup fields filled from real searches; if offline, say not searched — never invent CVE IDs |
| “Done” / “fixed research complete” | State remaining unknowns; do not imply CNA acceptance |

### Forbidden shortcuts

- Do not write submission-ready VulDB/GHSA/OSV prose for `blocked` or low-score `candidate` findings.
- Do not treat sink presence alone as a vulnerability.
- Do not attack live third-party services or auto-run exploit payloads.
- Do not create ThreatMap/Verification/report artifacts as fake proof during seed.
- Do not skip CLI validation by “manually eyeballing” YAML when `omv` is available.

## Red Flags (stop and correct)

| Thought | Reality |
|---|---|
| “This is obviously vulnerable” | Without source→sink→guard + version, it is a hypothesis |
| “I’ll confirm first and fill evidence later” | Confirm is a gate, not a vibe |
| “Review is optional for a draft” | Drafts must be labeled triage; never “ready to submit” |
| “Duplicate search will slow us down” | Missing dedup is a common CNA rejection |
| “One more skill will fix this” | Prefer stronger gates and better evidence; avoid skill sprawl |
| “The model said high confidence” | Confidence without file:line is still low for omv |
| “Surfaces/cards are overkill” | Cards are how we open problems; lanes alone are the thin path |

## Skill Priority

When multiple omv skills apply:

1. **Process** — this skill (`using-omv`), `/omv next`, campaign/surfaces  
2. **Depth** — find → audit → repro  
3. **Gate** — review / critic / dedup  
4. **Output** — report / disclose  

Do not jump to report because the user said “CVE” if Evidence is incomplete — run the gate and show the gap.

## Quality Over Sprawl

Prefer:

- tighter HARD-GATEs and CLI checks  
- better Attack Surface catalog and Evidence fields  
- adversarial verification when stakes are high  

Avoid:

- new `/omv-*` skills for every idea  
- parallel prose workflows that bypass `.omv/`  
- automating confirmation without observation  

## Minimal CLI Cheatsheet

```bash
omv dashboard
omv start --target <name> --ecosystem <eco> --vuln <classes> --no-interactive
omv campaign surfaces propose <id>
omv campaign surfaces select <id> --cards <id,id>
omv campaign seed <id>
omv findings validate <id>
omv review <id> --strict
```

If `omv` is missing: install it with `npm install --global oh-my-vul`. Pi already manages the Skills installed by `pi install npm:oh-my-vul`, so Pi users should continue with `omv version` or `omv start` and must not run `omv setup`. In Codex or Claude Code, run the matching `omv setup --platform codex|claude-code` command and re-check with `omv doctor --platform ...`.
