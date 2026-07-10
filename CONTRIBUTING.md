# Contributing

Thanks for your interest in `oh-my-vul`.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## What this project is for

`oh-my-vul` supports **passive** vulnerability research and **local** verification. It is not a live scanner or attack toolkit.

## Before you open an issue or PR

- Do **not** attach real private findings, credentials, exploit traffic against third parties, or unreleased vulnerability details.
- Prefer sanitized fixtures (`demo-*`, `example-*`, `fixture-*` names).
- Do **not** commit local research state under `.omv/`.
- Use [SECURITY.md](SECURITY.md) for security issues in this repository itself.

## Pull requests

Keep changes focused and explain user-visible behavior. Update [CHANGELOG.md](CHANGELOG.md) when the release-facing CLI or skills change.

Maintainers may ask for tests or skill eval updates when behavior changes.

## Safety

- No guidance for attacking live third-party services.
- No credential theft, exfiltration, or abuse payloads in docs or examples.
- Keep PoC examples local and minimal.
- Preserve uncertainty (`unknown`, blockers) instead of inventing proof.
