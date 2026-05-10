# Dart Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## Path traversal: file serving

- Source pattern: HTTP request path, user-provided filename, or API parameter controls a file path in a server-side Dart application.
- Sink signature: `File(path).readAsBytes()`, `File(path).readAsString()`, `shelf_static` handler with user path.
- Common misuse: user-controlled path segment is joined to a base directory without canonicalization or containment check.
- Expected guard: resolve canonical path, verify it starts with intended base, reject `..` and absolute paths, use `Uri.normalizePath`.
- Evidence criteria: show user input source, path construction, file I/O sink, and missing containment validation.
- False-positive checks: path is from hardcoded asset list, static file handler has built-in traversal protection, or input is validated against allowlist.
- CWE: CWE-22

## SSRF: http.get with user URL

- Source pattern: user input, webhook URL, or external config controls a URL passed to Dart HTTP client.
- Sink signature: `http.get(Uri.parse(userUrl))`, `HttpClient().getUrl(Uri.parse(url))`, `Dio().get(url)`.
- Common misuse: user-controlled URL is fetched without scheme restriction, hostname validation, or private IP filtering.
- Expected guard: parse URI, enforce https scheme, validate hostname against allowlist, resolve DNS and reject private ranges.
- Evidence criteria: show URL source, HTTP client call, and missing scheme/host validation.
- False-positive checks: URL is from trusted config, hostname is hardcoded, or request goes through a validated proxy.
- CWE: CWE-918

## Command injection: Process.run

- Source pattern: user input, filename, or external parameter is interpolated into a shell command string.
- Sink signature: `Process.run(executable, arguments)`, `Process.start(cmd, args)` with shell: true.
- Common misuse: user-controlled string is passed as shell command or unsanitized argument with `runInShell: true`.
- Expected guard: avoid `runInShell: true`, pass arguments as list elements (not interpolated strings), validate input against allowlist.
- Evidence criteria: show user input source, Process.run call with shell mode or string interpolation, and missing input sanitization.
- False-positive checks: arguments are from trusted enum, shell mode is disabled, or input is numeric-only.
- CWE: CWE-78
