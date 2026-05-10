# Java Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## SSRF: URLConnection and HTTP clients

- Source pattern: request parameter, webhook URL, config field, package metadata, or imported feed controls a URI.
- Sink signature: `new URL(input).openConnection()`, `HttpClient.send`, `RestTemplate.getForObject`.
- Common misuse: URL is fetched without scheme, host, redirect, or private-address checks.
- Expected guard: parse URI, enforce scheme and host allowlist, resolve DNS, reject internal ranges, and disable unsafe redirects.
- Evidence criteria: show source, URI construction, HTTP sink, and absent or bypassable guard.
- False-positive checks: fixed URI, host allowlist, network egress proxy with policy, private-range rejection, or unreachable code path.
- CWE: CWE-918

## XXE: XML parser defaults

- Source pattern: uploaded XML, request body, feed data, config file, or package metadata is parsed as XML.
- Sink signature: `DocumentBuilderFactory`, `SAXParserFactory`, `XMLInputFactory`.
- Common misuse: parser handles untrusted XML while external entities or DTDs remain enabled.
- Expected guard: disable DTDs and external entities, enable secure processing, and avoid resolving external resources.
- Evidence criteria: show untrusted XML source, parser factory configuration, parse call, and missing hardening flags.
- False-positive checks: secure features are set, parser rejects DTDs, resolver blocks external resources, or input is trusted-only.
- CWE: CWE-611

## Path traversal: file APIs

- Source pattern: HTTP parameter, archive member, upload filename, CLI argument, or config controls a path.
- Sink signature: `new File(base, input)`, `Paths.get(base, input)`, `Files.readAllBytes`.
- Common misuse: user-controlled path is resolved without canonical base containment.
- Expected guard: normalize and canonicalize target, reject absolute and parent traversal, require target starts with base.
- Evidence criteria: show source, path resolution, file sink, and missing containment check.
- False-positive checks: path comes from allowlist, canonical containment exists, sandboxed resource loader is used, or input is not attacker controlled.
- CWE: CWE-22
