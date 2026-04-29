# Security Policy

## Reporting a Vulnerability

If you find a security issue in `oh-my-vul`, please open a private report through GitHub Security Advisories if available, or contact the maintainer listed in `package.json`.

Please include:

- Affected version or commit.
- Impact and affected component.
- Minimal local reproduction steps.
- Whether the issue affects generated skill output, CLI installation, packaging, or helper scripts.

Do not include payloads that target live third-party services or exfiltrate credentials.

## Scope

In scope:

- CLI installation or path handling issues.
- Packaging issues that omit or corrupt skill assets.
- Helper scripts that mishandle local files or untrusted metadata.
- Skill instructions that encourage unsafe or misleading security reporting.

Out of scope:

- Vulnerabilities in third-party packages suggested by `/omv-find`.
- Reports that require attacking live systems.
- Social engineering or credential theft scenarios.

## Supported Versions

The latest published version receives security fixes. This project is still in the `0.x` series, so interfaces may evolve while the skill contracts stabilize.

