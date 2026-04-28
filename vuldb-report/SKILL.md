---
name: vuldb-report
description: "Generate a complete, ready-to-submit VulDB vulnerability report and CVE request. Covers all major package ecosystems: npm, pip, Go, Cargo (Rust), RubyGems, Maven, Gradle, NuGet, Composer (PHP), CocoaPods, Swift Package Manager, pub (Dart/Flutter), Hex (Elixir), CPAN (Perl), CRAN (R), LuaRocks. Use this skill whenever the user wants to submit a vulnerability to VulDB, request a CVE, write a security advisory, or document a security bug for disclosure. Trigger on phrases like submit to VulDB, request a CVE, write a CVE report, help me report this vuln, 提交 VulDB, 申请 CVE, 帮我报这个漏洞. Also trigger proactively when the user has just finished analysing a vulnerability in any package ecosystem and asks what to do next."
---

# VulDB Report Generator

## References

Load these when needed — do not load all at once:

- **`references/ecosystems.md`** — vendor naming rules, version verification commands, duplicate CVE search databases, CWE→Class mapping. Read when ecosystem-specific details are needed.
- **`references/cvss-builder.md`** — metric-by-metric CVSS v3.1 decision table with common vector combinations. Read when computing the CVSS score.
- **`references/examples/xss-npm.md`** — complete filled report for a click-triggered XSS in an npm package.
- **`references/examples/path-traversal-go.md`** — complete filled report for an unauthenticated path traversal in a Go module.

---

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

Generate a CVSS v3.1 vector. Read `references/cvss-builder.md` for the full metric decision table.

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
