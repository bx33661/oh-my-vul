# CVSS v3.1 Builder

Work through each metric in order. The final vector string goes in the report's Attack Requirements section and in the VulDB form's Description block.

Format: `CVSS:3.1/AV:_/AC:_/PR:_/UI:_/S:_/C:_/I:_/A:_`

---

## AV — Attack Vector

*Where does the attacker need to be to exploit this?*

| Value | Code | When to use |
|---|---|---|
| Network | `AV:N` | Exploitable remotely over the internet (most web/API/npm vulns) |
| Adjacent | `AV:A` | Requires same LAN / Bluetooth / Wi-Fi segment |
| Local | `AV:L` | Requires local OS account or physical access |
| Physical | `AV:P` | Requires touching the hardware |

Most package ecosystem vulns → `AV:N`

---

## AC — Attack Complexity

*After the attacker is in position, how hard is the attack itself?*

| Value | Code | When to use |
|---|---|---|
| Low | `AC:L` | No special conditions; attack works reliably every time |
| High | `AC:H` | Requires a race condition, specific config, or information gathering first |

Default to `AC:L` unless the attack has a meaningful prerequisite beyond just reaching the target.

---

## PR — Privileges Required

*What level of access must the attacker already have?*

| Value | Code | When to use |
|---|---|---|
| None | `PR:N` | No account or credentials needed |
| Low | `PR:L` | Requires a basic user account |
| High | `PR:H` | Requires admin / privileged account |

---

## UI — User Interaction

*Does a victim need to do something for the attack to succeed?*

| Value | Code | When to use |
|---|---|---|
| None | `UI:N` | Attack succeeds without victim action (e.g. server processes malicious input automatically) |
| Required | `UI:R` | Victim must click a link, open a file, or take some other action |

Click-to-trigger XSS → `UI:R`. Stored XSS that fires on page load → `UI:N`.

---

## S — Scope

*Does a successful attack affect components beyond the vulnerable one?*

| Value | Code | When to use |
|---|---|---|
| Unchanged | `S:U` | Impact stays within the vulnerable component's security boundary |
| Changed | `S:C` | Attack crosses a security boundary (e.g. browser XSS crosses origin boundary, container escape crosses host boundary) |

Reflected/stored XSS in a browser → `S:C`. Server-side injection that only affects the same process → `S:U`.

---

## C / I / A — Confidentiality, Integrity, Availability Impact

*How badly is each dimension affected?*

| Value | Code | When to use |
|---|---|---|
| None | `C:N` / `I:N` / `A:N` | No impact on this dimension |
| Low | `C:L` / `I:L` / `A:L` | Partial or limited impact; attacker does not gain full control |
| High | `C:H` / `I:H` / `A:H` | Total loss of confidentiality / integrity / availability |

---

## Common Vector Combinations

| Scenario | Vector | Score | Level |
|---|---|---|---|
| XSS, click required, browser scope | `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` | 6.1 | Medium |
| Stored XSS, auto-fires on page load | `AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N` | 7.2 | High |
| RCE via deserialization, no auth | `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` | 9.8 | Critical |
| Path traversal, read arbitrary files | `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` | 7.5 | High |
| SQLi, no auth, data exfil | `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` | 9.1 | Critical |
| Auth bypass, no interaction | `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` | 9.8 | Critical |
| SSRF, internal network access | `AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N` | 8.6 | High |
| Prototype pollution → RCE | `AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H` | 8.1 | High |
| ReDoS, no auth, remote | `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` | 7.5 | High |
| Info disclosure, low sensitivity | `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` | 5.3 | Medium |

---

## Score → Severity Mapping

| Score | Severity |
|---|---|
| 9.0 – 10.0 | Critical |
| 7.0 – 8.9 | High |
| 4.0 – 6.9 | Medium |
| 0.1 – 3.9 | Low |

Use the [NVD CVSS calculator](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator) to verify your score.
