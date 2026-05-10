# Go Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## SSRF: net/http client

- Source pattern: HTTP request data, webhook settings, CLI flags, package metadata, or config controls a URL or hostname.
- Sink signature: `http.Get(url)`, `http.Client.Do(req)`, `http.NewRequest(method, url, body)`.
- Common misuse: URL is fetched without host/IP allowlist, scheme restriction, redirect policy, or timeout.
- Expected guard: parse URL, restrict scheme, validate hostname, resolve and reject private ranges, configure redirect checks and timeouts.
- Evidence criteria: show source, URL construction, request creation, client execution, and missing guard.
- False-positive checks: URL is fixed, host is allowlisted, private ranges are rejected, redirect handling blocks escapes, or sink is unreachable.
- CWE: CWE-918

## Path traversal: os and filepath

- Source pattern: route parameter, archive member, uploaded filename, CLI argument, or config controls a path segment.
- Sink signature: `os.ReadFile`, `os.Open`, `os.WriteFile`, `filepath.Join(base, input)`.
- Common misuse: user-controlled path is joined with a base directory without `Clean` plus containment checks.
- Expected guard: clean and resolve path, reject absolute paths and `..`, require final path to remain under the base directory.
- Evidence criteria: show source, path join/clean sequence, filesystem sink, and missing final base containment check.
- False-positive checks: enum-selected file, base containment after clean, `fs.ValidPath` with embedded FS constraints, or trusted-only source.
- CWE: CWE-22

## Command injection: exec

- Source pattern: request value, CLI argument, config field, or package metadata controls command text or arguments.
- Sink signature: `exec.Command("sh", "-c", input)`, `exec.Command(binary, args...)`.
- Common misuse: command string or shell arguments include untrusted input without allowlist validation.
- Expected guard: avoid shell invocation, pass fixed binary and validated arguments, use allowlisted option sets.
- Evidence criteria: show untrusted source, argument construction, exec sink, and absent validation.
- False-positive checks: no shell is used, binary and args are fixed/allowlisted, source is trusted, or code path is test-only.
- CWE: CWE-78
