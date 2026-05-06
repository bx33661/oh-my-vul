# Rust Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## SSRF: HTTP client URL

- Source pattern: request field, webhook configuration, CLI argument, package metadata, or config controls a URL.
- Sink signature: `reqwest::get(url)`, `Client::get(url)`, `ureq::get(url)`.
- Common misuse: URL is fetched without host allowlist, IP filtering, redirect policy, or timeout.
- Expected guard: parse with `url`, restrict scheme, validate hostname, resolve and reject private networks, set redirect policy.
- Evidence criteria: show source, URL construction, client call, and missing or bypassable guard.
- False-positive checks: fixed URL, host allowlist, private-range rejection, redirect control, or source is trusted-only.
- CWE: CWE-918

## Path traversal: filesystem access

- Source pattern: route parameter, archive member, filename option, CLI argument, or config controls a path segment.
- Sink signature: `std::fs::read`, `File::open`, `PathBuf::push`, `join`.
- Common misuse: untrusted path segment is joined with a base path without canonical containment validation.
- Expected guard: canonicalize base and target, reject absolute and parent components, require target starts with canonical base.
- Evidence criteria: show source, path construction, filesystem sink, and missing containment check.
- False-positive checks: path is enum-selected, canonical containment exists, embedded resource loader is used, or source is trusted.
- CWE: CWE-22

## Deserialization: unsafe format or type confusion

- Source pattern: request body, uploaded bytes, queue message, cache value, or config input reaches deserialization.
- Sink signature: `bincode::deserialize`, `serde_yaml::from_str`, custom `Deserialize` on untrusted input.
- Common misuse: untrusted bytes are deserialized into high-impact types without size limits or schema constraints.
- Expected guard: size limits, strict schemas, safe formats, and post-deserialization validation.
- Evidence criteria: show source, deserialization call, target type, limits, and reachable impact path.
- False-positive checks: input authenticated, schema constrained, size-limited, safe target type, or parser handles data-only structures.
- CWE: CWE-502
