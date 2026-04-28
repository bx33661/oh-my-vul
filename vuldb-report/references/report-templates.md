# Report Templates

Use these templates when the user asks for a specific output format. Keep the facts consistent across formats, but do not force one platform's field syntax into another platform.

## VulDB Template

```markdown
## VulDB Form Fields

**Vendor**
<project owner, GitHub org, company, or author>

**Product**
<package or product name>

**Version**
<affected range using VulDB wording, for example "up to and including 1.2.3" or "before 1.2.4">

**Class**
<plain English class name, not the CWE number>

**Description**
<continuous prose with affected component, root cause, attacker action, impact, attack requirements, affected file/function, and suggested fix>

**Advisory / Exploit**
<single stable URL, or "not public yet">

**CVE checkbox**
<state whether vendor contact, no existing CVE, and no other CNA submission are all true>
```

## GHSA Template

```markdown
## GitHub Security Advisory

**Ecosystem**
<npm / pip / Go / RubyGems / Maven / NuGet / Composer / Pub / Erlang / Rust / GitHub Actions>

**Package name**
<registry package name>

**Affected versions**
<GHSA range syntax, for example ">= 1.0.0, < 1.2.4">

**Patched versions**
<first fixed version, or blank if no fix>

**Severity**
<Critical / High / Medium / Low>

**CWE IDs**
<CWE-...>

**Title**
<product>: <vulnerability class> in <component>

**Description**
### Summary
...

### Details
...

### Impact
...

### Proof of Concept
...

### Recommended Fix
...
```

## OSV Template

OSV records are structured vulnerability database entries. Generate OSV only when the user asks for OSV, OpenSSF, `osv.dev`, or machine-readable advisory output.

```json
{
  "schema_version": "1.6.0",
  "id": "TBD",
  "modified": "YYYY-MM-DDT00:00:00Z",
  "published": "YYYY-MM-DDT00:00:00Z",
  "summary": "<short vulnerability summary>",
  "details": "<root cause, affected component, impact, and attack requirements>",
  "affected": [
    {
      "package": {
        "ecosystem": "<OSV ecosystem>",
        "name": "<package name>"
      },
      "ranges": [
        {
          "type": "SEMVER",
          "events": [
            {"introduced": "0"},
            {"fixed": "<fixed version>"}
          ]
        }
      ],
      "versions": [
        "<tested affected version>"
      ],
      "database_specific": {
        "source": "<source -> sink -> guard evidence summary>"
      }
    }
  ],
  "references": [
    {
      "type": "WEB",
      "url": "<advisory, issue, source permalink, or PoC URL>"
    }
  ],
  "severity": [
    {
      "type": "CVSS_V3",
      "score": "<CVSS:3.1/...>"
    }
  ]
}
```

OSV ecosystem names differ from GHSA labels. Common values: `npm`, `PyPI`, `Go`, `crates.io`, `RubyGems`, `Maven`, `NuGet`, `Packagist`, `Pub`, `Hex`, `CPAN`, `CRAN`.

If there is no fixed version, use only `{"introduced": "0"}` and state in `details` that no patched version is known. Do not invent an OSV ID.

## Standalone Markdown Advisory Template

```markdown
# <product>: <vulnerability class> in <component>

## Summary
<one paragraph>

## Affected Versions
- Package: `<ecosystem>:<name>`
- Tested version: `<version>`
- Affected range: `<range>`
- Fixed version: `<version or none known>`

## Technical Details
<source -> sink -> guard explanation with file/function and code reference>

## Impact
<attacker control, required auth, user interaction, scope, and security impact>

## Proof of Concept
<minimal local reproducer without credential theft or live-service exploitation>

## Remediation
<specific fix>

## Disclosure Timeline
- YYYY-MM-DD: <event>

## References
- <source permalink>
- <issue/advisory/PoC URL>
```

Use this format for blog posts, maintainer reports, email drafts, and attachments when no platform-specific schema is requested.
