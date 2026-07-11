---
name: omv-report
description: "Generate a complete, ready-to-submit VulDB vulnerability report and CVE request. Covers all major package ecosystems: npm, pip, Go, Cargo (Rust), RubyGems, Maven, Gradle, NuGet, Composer (PHP), CocoaPods, Swift Package Manager, pub (Dart/Flutter), Hex (Elixir), CPAN (Perl), CRAN (R), LuaRocks. Use this skill whenever the user wants to submit a vulnerability to VulDB, request a CVE, write a security advisory, or document a security bug for disclosure. Trigger on phrases like submit to VulDB, request a CVE, write a CVE report, help me report this vuln, 提交 VulDB, 申请 CVE, 帮我报这个漏洞. Also trigger proactively when the user has just finished analysing a vulnerability in any package ecosystem and asks what to do next."
---

# VulDB Report Generator

## References

Load these when needed — do not load all at once:

- **`references/ecosystems.md`** — vendor naming rules, version verification commands, duplicate CVE search databases, CWE→Class mapping. Read when ecosystem-specific details are needed.
- **`references/shared/cvss-builder.md`** — metric-by-metric CVSS v3.1 decision table with common vector combinations. Read when computing the CVSS score.
- **`contracts/evidence.v1.yaml`** — structured input contract from `omv-find`; read when the user provides a handoff packet or asks to continue from finder results.
- **`contracts/verification.v1.yaml`** — adversarial review sidecar. Read when `.omv/verifications/<id>.yaml` exists or the user asks for a high-confidence report.
- **`contracts/source-ref.v1.yaml`** — optional local source identity sidecar. Read when `.omv/sources/<id>.yaml` exists; a locator is recorded input, not proof of remote authenticity.
- **`contracts/report-provenance.v1.yaml`** — generated report input manifest shape used by `omv report provenance`.
- **`references/report-templates.md`** — reusable VulDB, GHSA, OSV, and standalone Markdown advisory templates. Read when the user requests a specific report format.
- **`references/examples/xss-npm.md`** — complete filled report for a click-triggered XSS in an npm package.
- **`references/examples/path-traversal-go.md`** — complete filled report for an unauthenticated path traversal in a Go module.
- **`references/examples/prototype-pollution-npm.md`** — filled report for prototype pollution in an npm package.
- **`references/examples/redos-python.md`** — filled report for ReDoS in a Python package.

---

## HARD-GATE: verification before submission-ready claims

```text
NO submission-ready VulDB / CVE / GHSA / OSV prose WITHOUT fresh gate evidence:
  1. omv findings validate <id> OK (when CLI available)
  2. status: confirmed
  3. submissionScore ≥ 75
  4. omv review <id> --strict → ready   (or user explicitly asks for triage draft only)
```

If the gate fails: explain gaps, suggest `/omv-audit`, `/omv-repro`, `/omv-critic`, or `omv review`.  
Label any incomplete output **triage draft — not for submission**.  
Do not rationalize “almost ready” into submission-ready wording.

## Validity Check

Flag these patterns before writing — each one is a common rejection reason:

| Pattern | Why VulDB rejects it |
|---|---|
| Attacker must supply the app's own code/config to trigger | Classified as developer misuse, not a library vuln |
| Sink found (`eval`, `innerHTML`, `window.open`) but no attacker-controlled input path proven | Sink ≠ vulnerability — prove the full data flow |
| No concrete tested version number | Submissions without a version boundary get rejected |
| Theoretical risk, no PoC | Requires a reproducible demonstration |
| Likely duplicate CVE exists | Search NVD, GHSA, and the ecosystem DB first |

If a flag appears, tell the user what is missing and how to address it before continuing.

If the input is an `omv-find` handoff packet (Evidence.v1), apply `contracts/evidence.v1.yaml` before drafting:

- `status: blocked` means explain blockers instead of writing a submission-ready report.
- `status: candidate` means produce a triage draft only.
- `status: confirmed` can become a submission-ready report if required fields are present.
- Preserve unverified fields as unverified; do not silently upgrade them to confirmed facts.

## Evidence Preflight

Before writing any submission-ready report from finder output, consume the local validation result:

1. If the user gives a finding id such as `demo`, read `.omv/findings/demo.yaml`.
2. If the user gives a path, read that Evidence.v1 file.
3. Run or ask for `omv findings validate <id|path> --json` when CLI tools are available.
4. If `.omv/threatmaps/<id>.yaml` exists, run or ask for `omv threat-map validate <id> --json`.
5. If `.omv/verifications/<id>.yaml` exists or the user wants a strict pre-submission gate, run or ask for `omv verification validate <id> --json` and `omv review <id> --strict --json`.
6. If `.omv/sources/<id>.yaml` exists, run or ask for `omv sources validate <id> --json`; treat a stale hash as a traceability warning, not as proof or disproof of the vulnerability.
7. If CLI tools are unavailable, validate manually against `contracts/evidence.v1.yaml`, `contracts/verification.v1.yaml`, and `contracts/source-ref.v1.yaml` when relevant, and say that deterministic validation was not run.

Use the validation result to choose output mode:

- Validation errors: lead with the errors and blockers; do not produce a submission-ready VulDB/CVE/GHSA/OSV report.
- ThreatMap errors: do not use graph claims as report proof until `omv threat-map validate <id>` passes.
- Verification failure, stale hash, or non-pass decision under strict verification: do not produce a submission-ready report; list the verifier disagreements or required changes first.
- `status: blocked`: explain blockers and minimum evidence needed.
- `status: candidate`: produce only triage notes or a draft outline clearly marked not ready for submission.
- `status: confirmed`: proceed only if required evidence is present and submission score is at least 75/100 (`submissionScore` = `submission_score` in contract — the gating score after deducting blockers/unverified fields/confidence penalties); include validation warnings in the pre-submission checklist.
- `submissionScore` below 75 or `verdict.exploitability` not `proven`: do not produce a submission-ready report; explain what evidence or reproduction artifact is missing.
- `evidence.repro_artifacts` present: reference the artifacts as local reviewer evidence. If absent, warn that the report depends only on inline reproducer text.

### Deterministic Skeleton Renderer

For confirmed findings with submission score ≥ 75, run the deterministic renderer first to get a pre-filled skeleton. Resolve `scripts/render_template.py` relative to this installed `SKILL.md`; do not assume one global install directory.

macOS/Linux:

```bash
python3 <installed-skill-dir>/scripts/render_template.py \
  --finding .omv/findings/<id>.yaml --format vuldb|ghsa|osv|md
```

Windows PowerShell (the Python launcher is preferred):

```powershell
py -3 <installed-skill-dir>\scripts\render_template.py `
  --finding .omv\findings\<id>.yaml --format vuldb
```

`<installed-skill-dir>` is the `omv-report` directory discovered by the active Agent. User-level defaults are `~/.agents/skills/omv-report` for Codex and `~/.claude/skills/omv-report` for Claude Code; project installs use `.agents/skills/omv-report` or `.claude/skills/omv-report`.

The renderer fills all structural fields (package, versions, CVSS, CWE, source→sink→guard, reproducer, dedup checklist) and leaves `[DRAFT: ...]` markers for prose sections. Fill in every `[DRAFT: ...]` before submitting. Do not submit placeholders.

After producing a submission-ready report for a confirmed finding, record and check its local inputs when the report was written under `.omv/reports/<id>/`:

```bash
omv sources init <id>              # optional; derives only known Evidence source facts
omv report provenance <id>        # run after report files are written
omv report artifacts <id>
```

SourceRef and report provenance are local hash records. Do not claim they verify remote repository authenticity. A legacy report without `provenance.json` remains usable but receives a warning until a manifest is created.

Then suggest removing it from the active local queue:

```bash
omv findings archive <id> --reason reported
```

If the report was written under `.omv/reports/<id>/`, the archive command records those artifact paths in archive metadata. For a stricter local gate, use:

```bash
omv findings archive <id> --reason reported --strict
```

Do not archive automatically unless the user asks; archiving is project-management state, not part of Evidence.v1 validation.

---

## Severity

Pick one level and briefly explain the reasoning — overstating severity causes reviewers to distrust the whole report.

| Severity | Conditions |
|---|---|
| Critical | RCE or auth bypass, no interaction, no auth, triggered by default config |
| High | High impact but requires auth **or** one user action; or severe data loss without interaction |
| Medium | Requires user interaction (e.g. click); or limited blast radius |
| Low | Info disclosure; DoS with heavy prerequisites |

> XSS that requires a click = **Medium**, always — even if session tokens are theoretically at risk.

Generate a CVSS v3.1 vector. Read `references/shared/cvss-builder.md` for the full metric decision table.

---

## Part A — VulDB Form Fields

Output each field as a labelled block in the order they appear on the submission page.

**Vendor**
```
[project name / GitHub org / author name — not the registry]
```

**Product**
```
[package or product name]
```

**Version**
```
[affected range]
```
- `up to and including 4.0.3` — tested, no fix yet
- `before 4.0.4` — fix exists in 4.0.4
- `4.0.3 (older versions may also be affected)` — one version tested
- `4.x / 3.x` — multiple major lines (same slash style as `10/11` for Windows)

Never use: `≤ 4.0.3`, `latest version`, `all versions`

**Class**
```
[plain English class name — not a CWE number]
```
See `references/ecosystems.md` for the full CWE→Class mapping table.

**Description**

Continuous prose — no Markdown headings or bullet lists. Use this sentence structure:

```
A [vulnerability type] vulnerability was found in [product] up to and including version
[version]. It has been classified as [class name].

The issue affects [file/function/component]. The vulnerability is caused by [root cause —
one sentence].

An attacker can [attack action], resulting in [security impact]. Exploitation requires
[auth / user interaction / special config], and the attack can be performed [remotely/locally].

Affected component: [file path]
Affected function: [function name]

Root cause: [one sentence — what check is missing or wrong]

Suggested fix: [concrete mitigation — name the exact check, allowlist, or rejection rule]
```

If user interaction is required, state it explicitly in the second paragraph — e.g. *"The vulnerability is triggered when the victim clicks the rendered element."* This one sentence prevents reviewers from assuming the severity is exaggerated.

**Advisory / Exploit**
```
[single URL — most stable one available]
```
Stability order: GitHub Security Advisory > GitHub Issue > GitHub Gist > blog post > public PoC repo > Notion page

**CVE checkbox**

The form requires all three: (1) vendor contacted beforehand, (2) no CVE assigned yet, (3) not submitted to another CNA. See the CVE checklist at the end.

---

## Part B — Full Advisory

For GitHub Security Advisory, blog posts, or attachments. Markdown is supported here.

**Title**
```
[product] up to [version] [component] [VulnerabilityClass]
```
Example: `canvg up to 4.0.3 AElement.ts onClick javascript URI Cross-Site Scripting`

**Summary**

A [vulnerability type] vulnerability was found in [vendor / product] up to and including version [version]. It has been classified as [CWE name].

**Affected Component**

| Field | Value |
|---|---|
| File | `path/to/file` |
| Function | `functionName()` |
| Package | `ecosystem:name` (e.g. `npm:canvg`) |
| Version tested | x.y.z |
| Affected versions | up to and including x.y.z |
| Fixed version | x.y.z / none at time of reporting |

**Root Cause**

[One paragraph: what data flows where, why the check is absent or wrong. Quote the key line(s) of code when available.]

**Impact**

An attacker who can [what the attacker controls] can [attack action]. [State required interaction explicitly.] This results in [security impact].

**Attack Requirements**

- Attack vector: Network / Local
- Authentication required: Yes / No
- User interaction required: Yes / No
- Preconditions: [non-default setup required, if any]
- Scope: Changed / Unchanged
- CVSS v3.1: `[vector]` — [score] ([level])

**Proof of Concept**

Verification payloads only — no cookie-exfiltration or outbound-request payloads.

Install:
```bash
npm install <pkg>@<ver>      # npm
pip install <pkg>==<ver>     # pip
go get <mod>@<ver>           # Go
cargo add <crate>@<ver>      # Cargo, then: cargo build
```

Malicious input / trigger / result: [minimal reproducer]

> A self-contained HTML file that reviewers can open directly significantly improves acceptance rate. A screenshot or short GIF is strongly recommended.

**Reproduction Steps**

1. Install the affected version
2. Set up the minimal environment
3. Supply the malicious input
4. Perform the trigger action
5. Observe: [expected vulnerable result]

**Suggested Fix**

[Specific mitigation — name the exact check, allowed values, or rejection rule. Not just "validate input".]

**Vendor Contact**

[Disclosure timeline: when reported, via what channel, response received. State honestly if not yet contacted.]

**References**

- [Source permalink to vulnerable code]
- [GitHub issue or Security Advisory]
- [PoC Gist or repository]

---

## Part C — GitHub Security Advisory (GHSA)

Generate this when the user wants to open a GHSA. GHSA fields differ from VulDB — Markdown is fully supported in the description, and filing a GHSA auto-triggers a CVE request once published.

**Ecosystem** *(dropdown — use exact values)*
```
npm / PyPI / Go / RubyGems / Maven / NuGet / Hex / Pub / Cargo / GitHub Actions
```

**Package name**
```
[exact package name as it appears in the registry]
```

**Affected versions** *(semver range syntax)*
```
>= 1.0.0, < 1.2.3     # vulnerable range with a fix available
>= 0.0.1              # all versions, no fix yet
```

**Patched version**
```
1.2.3     # first safe version, or leave blank if no fix
```

**Severity** *(dropdown)*
```
Critical / High / Medium / Low
```

**CWE IDs**
```
CWE-79     # enter the number(s) — multiple allowed
```

**Title**
```
[product]: [VulnerabilityClass] in [component]
```
Example: `canvg: Cross-Site Scripting in AElement.ts onClick via javascript: URI`

**Description** *(Markdown supported)*

```markdown
## Summary

[One paragraph: what the vulnerability is, where it is, what an attacker can do.]

## Details

[Root cause with code reference. Explain why the check is absent or wrong.]

## Impact

[Who is affected, what data or systems are at risk, what conditions are required.]

## Proof of Concept

[Minimal reproducer — install command, payload, trigger, expected result.]

## Recommended Fix

[Concrete mitigation.]
```

**References**

Add URLs to: source permalink, existing issue, PoC. GHSA will display these publicly once the advisory is published.

> Once you publish a GHSA (or request a CVE through it), do not also submit the same issue to VulDB unless the GHSA CVE request is explicitly rejected — filing both creates a duplicate CVE risk.

---

## Part D — OSV and Markdown Advisory Outputs

Generate OSV JSON when the user asks for OSV, OpenSSF, `osv.dev`, or machine-readable advisory output. Generate a standalone Markdown advisory when the user asks for a blog post, maintainer report, email advisory, or generic disclosure note.

Read `references/report-templates.md` for exact field layout. OSV output must be valid JSON and must not invent an advisory ID. If no fixed version is known, omit the fixed event and state that no patch is available in `details`.

---

## Deterministic Helpers

Use bundled scripts when they fit the task:

- `scripts/check_output.py`: runs heuristic eval assertions against a saved `omv-report` output. It checks platform fields, blocked handoff behavior, OSV JSON structure, duplicate CNA warnings, severity sanity, and safe PoC wording.

---

## CVE Request Checklist

- [ ] Affects a real product, not test or example code
- [ ] Clear vendor / product / version
- [ ] Real security impact — not just a bug
- [ ] Searched for existing CVEs in the right databases (see `references/ecosystems.md`)
- [ ] No GHSA number already assigned
- [ ] No other CNA currently processing this issue
- [ ] Vendor has been contacted, or there is a documented reason why not

---

## Pre-Submit Checklist

- [ ] Severity matches actual attack conditions — not overstated
- [ ] Class field uses plain English name, not a CWE number
- [ ] Version uses `up to and including` or `before` — not `≤` or `latest`
- [ ] Vendor is the project name — not the registry name
- [ ] CVSS v3.1 vector included
- [ ] PoC uses a verification payload only (`alert(document.domain)`)
- [ ] Full exploit path described: attacker control point → vulnerable code → impact
- [ ] Advisory URL is publicly accessible
- [ ] Duplicate CVE search completed
- [ ] Vendor contact status stated honestly
- [ ] Screenshot or GIF attached (optional but meaningfully improves acceptance rate)

## Subagent Team Orchestration

这个 skill 在关键环节可以委托给专门 subagent：

- **`cvss-analyst`** — 从 Evidence.v1 impact 字段计算 CVSS v3.1 vector、score、severity。当 impact 字段已填且需要严格评分时委托：
  ```
  Use the cvss-analyst subagent to compute CVSS from: <vuln_class>, <impact_fields>
  ```
- **`dedup-analyst`** — 在递交前检索 NVD/GHSA/OSV 是否已有相同 advisories。submission 前强制推荐：
  ```
  Use the dedup-analyst subagent to check duplicates for: <ecosystem>, <package>, <vuln_class>
  ```
- **`report-writer`** — 从 confirmed Evidence.v1 推导具体平台格式（VulDB / GHSA / OSV / Markdown）。当用户指定特定格式时委托：
  ```
  Use the report-writer subagent to render: <finding_id>, <formats[]>
  ```
- **`verifier`** — submission 前对 evidence 结论做对抗复核（默认反驳 bias），并把结果写入 Verification.v1。提升 submission 信心时推荐：
  ```
  Use the verifier subagent with the cvss-deflate lens to refute the CVSS scoring for <finding_id>, then record the result in .omv/verifications/<id>.yaml
  ```

Subagent 是可选优化，不是强制。Codex 使用当前会话的原生 delegation，Claude Code 可使用 `.claude/agents/*.md` 中的角色定义。不要只把 verifier 结论保存在聊天记录里；如果它影响报告可信度，必须记录到 Verification.v1。
