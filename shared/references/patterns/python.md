# Python Vulnerability Pattern Registry

Use these entries as audit methods. Do not treat them as examples of any specific real package.

## SSRF: requests with untrusted URL

- Source pattern: request data, webhook settings, package metadata, config values, or imported feed data controls a URL or hostname.
- Sink signature: `requests.get(url)`, `urllib.request.urlopen(url)`, `httpx.get(url)`, `aiohttp.ClientSession.get(url)`.
- Common misuse: URL is fetched without allowlist, scheme restriction, private-address filtering, redirect control, or timeout.
- Expected guard: parse URL, enforce scheme and hostname allowlist, resolve DNS, reject loopback/link-local/private networks, disable unsafe redirects.
- Evidence criteria: show source, URL construction, HTTP sink, and absent or bypassable guard with file:line references.
- False-positive checks: fixed host, validated allowlist, private-network rejection, test-only path, or source cannot be attacker controlled.
- CWE: CWE-918

## Unsafe YAML load

- Source pattern: uploaded file, request body, CLI input, plugin config, or package metadata is parsed as YAML.
- Sink signature: `yaml.load(data)`, `yaml.unsafe_load(data)`.
- Common misuse: untrusted YAML is parsed with constructors that can instantiate arbitrary Python objects.
- Expected guard: use `yaml.safe_load`, schema validation, and reject custom tags from untrusted input.
- Evidence criteria: show untrusted YAML source, unsafe parser call, loader configuration, and reachable code path.
- False-positive checks: safe loader is used, input is trusted and local-only, custom constructors are disabled, or parsed schema rejects custom tags.
- CWE: CWE-502

## Path traversal: archive extraction

- Source pattern: archive member names, uploaded filenames, CLI paths, or request parameters control output paths.
- Sink signature: `ZipFile.extractall`, `TarFile.extractall`, manual `open(os.path.join(base, name))`.
- Common misuse: member names are extracted without checking absolute paths or `..` traversal.
- Expected guard: resolve each destination path and require it to remain inside the extraction directory.
- Evidence criteria: show untrusted member/path source, path join/extract sink, and missing containment check.
- False-positive checks: member names are normalized and base-checked, extraction target is isolated, or only trusted bundled archives are accepted.
- CWE: CWE-22
