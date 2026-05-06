# Ruby Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## SSRF: Net::HTTP and URI.open

- Source pattern: params, webhook setting, config value, package metadata, or imported feed controls a URI.
- Sink signature: `Net::HTTP.get(URI(url))`, `URI.open(url)`, `Faraday.get(url)`.
- Common misuse: URL is fetched without allowlist checks, private-range filtering, redirect limits, or timeout.
- Expected guard: parse URI, enforce scheme and hostname allowlist, resolve DNS, reject private ranges, limit redirects.
- Evidence criteria: show source, URI construction, HTTP sink, and missing or bypassable guard.
- False-positive checks: fixed URL, allowlisted host, internal ranges rejected, redirect policy enforced, or trusted-only source.
- CWE: CWE-918

## Unsafe deserialization

- Source pattern: request body, uploaded file, cache value, queue message, or config input reaches object deserialization.
- Sink signature: `Marshal.load`, `YAML.load`, `Psych.load`.
- Common misuse: untrusted bytes or YAML are loaded into Ruby objects.
- Expected guard: use `YAML.safe_load` with restricted classes, avoid Marshal for untrusted data, and validate schema.
- Evidence criteria: show untrusted source, deserialize call, allowed classes/options, and reachable code path.
- False-positive checks: safe loader is used, classes are restricted, source is trusted, or data is authenticated before load.
- CWE: CWE-502

## Path traversal: file operations

- Source pattern: params, upload filename, archive member, CLI argument, or config controls a path.
- Sink signature: `File.read(File.join(base, input))`, `send_file`, archive extraction helpers.
- Common misuse: untrusted filename is joined with a base path without expanded path containment.
- Expected guard: `File.expand_path`, reject absolute and parent paths, require expanded path to start with expanded base.
- Evidence criteria: show source, path join/expand sequence, file sink, and missing base check.
- False-positive checks: allowlisted filename, expanded path containment, framework helper with safe root option, or trusted-only path.
- CWE: CWE-22
