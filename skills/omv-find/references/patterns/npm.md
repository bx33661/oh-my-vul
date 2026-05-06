# npm Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## SSRF: dynamic outbound URL

- Source pattern: HTTP body, query string, webhook target, callback URL, package metadata, or config value controls a URL or hostname.
- Sink signature: `http.request(userUrl)`, `https.get(userUrl)`, `fetch(userUrl)`, `axios.get(userUrl)`, `got(userUrl)`.
- Common misuse: request URL is fetched without scheme restriction, hostname allowlist, DNS/IP filtering, redirect policy, or timeout.
- Expected guard: parse with `new URL`, enforce scheme and hostname allowlist, resolve DNS, reject private/link-local/loopback ranges, limit redirects, set timeouts.
- Evidence criteria: show file:line source, URL construction, sink call, and absent or bypassable guard; note tested version and local observation status.
- False-positive checks: static internal URL, fixed host allowlist, proxy-only fetch, test-only code, blocked redirects, or private-range rejection before the sink.
- CWE: CWE-918

## Path traversal: filesystem path join

- Source pattern: request parameter, archive member name, filename option, CLI argument, or config key controls a path segment.
- Sink signature: `fs.readFile`, `fs.writeFile`, `createReadStream`, `path.join(base, input)`.
- Common misuse: user-controlled path is joined with a base directory without canonical containment checks.
- Expected guard: resolve real path, normalize, reject absolute and parent traversal, and require the resolved path to remain under the intended base.
- Evidence criteria: show source path segment, join/resolve operation, filesystem sink, and missing containment check.
- False-positive checks: path is chosen from an enum, normalized and base-checked before use, or sink is unreachable from untrusted input.
- CWE: CWE-22

## Prototype pollution: recursive merge

- Source pattern: attacker-controlled JSON, query object, config object, or plugin options reach a recursive merge or assignment helper.
- Sink signature: `merge(target, source)`, `lodash.merge`, custom deep assignment into object keys.
- Common misuse: keys such as `__proto__`, `constructor`, or `prototype` are copied into plain objects.
- Expected guard: reject dangerous keys recursively, use null-prototype objects for untrusted maps, and constrain merge targets.
- Evidence criteria: show untrusted object source, recursive key traversal, assignment sink, and missing key guard.
- False-positive checks: dangerous keys filtered recursively, object is not attacker-controlled, merge target is isolated, or code uses safe structured clone.
- CWE: CWE-1321
