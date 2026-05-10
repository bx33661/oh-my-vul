# Vulnerability Pattern Reference

Use this reference after parsing `--vuln`. High-ranked candidates need source -> sink -> guard evidence, not just keyword hits.

When the request is framed around a research playbook, load `research-radar.md` and `pattern-packs.md` as companions:

- `pattern-packs.md` maps package types such as archive extractors, renderers, template engines, config loaders, media tools, webhook clients, and upload handlers to the vulnerability classes below.
- `research-radar.md` explains portfolio lanes, diff signals, novelty checks, duplicate risk, and audit-readiness fields.

Keep playbook tags separate from vulnerability aliases. For example, an `archive-extractor` candidate may carry `traversal`, `race`, and `overflow` directions, but the source -> sink -> guard evidence still decides the ranking.

## Alias Map

| Alias | Meaning |
|---|---|
| `proto` | Prototype Pollution |
| `traversal` | Path Traversal / Zip Slip |
| `ssrf` | SSRF |
| `injection` | Command / Template Injection |
| `xss` | XSS / unsafe HTML rendering |
| `redos` | ReDoS |
| `yaml` | YAML / XML / JSON parsing bugs |
| `unsafe` | Rust unsafe / memory safety / panic DoS |
| `deser` | Deserialization |
| `race` | Race condition / TOCTOU |
| `overflow` | Integer overflow / out-of-bounds |
| `auth` | Authentication / authorization bypass |
| `csrf` | Cross-Site Request Forgery |
| `xxe` | XML External Entity |
| `sql` | SQL / NoSQL Injection |
| `ssti` | Server-Side Template Injection |
| `sandbox` | Sandbox / plugin escape |
| `redirect` | Open Redirect |
| `upload` | File upload bypass |
| `crypto` | Weak cryptography / key handling |
| `infoleak` | Information disclosure |

## Source / Sink / Guard Patterns

| Class | Sources | Sinks | Guards to look for |
|---|---|---|---|
| Path Traversal / Zip Slip | archive entry names, uploaded filenames, CLI paths, config paths | `path.join`, `path.resolve`, `open`, `writeFile`, `os.Open`, `filepath.Join`, `zipfile`, `tarfile`, extraction helpers | normalize then verify base prefix, reject absolute paths, reject `..`, handle symlinks |
| Prototype Pollution | parsed JSON/YAML objects, merge options, plugin config | recursive merge, clone, set-by-path, `__proto__`, `constructor`, `prototype` | key denylist, own-property checks, null-prototype objects |
| SSRF | user-controlled URLs, webhook targets, image/import URLs | `fetch`, `axios`, `http.Get`, `requests`, URL loaders | scheme allowlist, host allowlist, DNS/IP private range blocking, redirect policy |
| Command / Template Injection | CLI args, config, request data, template strings | `exec`, `spawn`, `eval`, `new Function`, `subprocess`, `os.system`, template render from strings | argument arrays, no shell, escaping, fixed templates |
| XSS | Markdown/HTML input, sanitizer config, renderer plugins | `innerHTML`, unsafe React HTML, raw HTML renderer | trusted sanitizer, escaping, safe renderer config |
| ReDoS | user patterns, parser input, generated regex | dynamic `RegExp`, complex nested regex over untrusted input | bounded input, safe-regex checks, timeouts |
| YAML/XML/JSON | YAML/XML/config text, serialized payloads | unsafe `yaml.load`, XML entity parsing, `pickle.loads`, custom object hooks | safe loader, entity disablement, schema restriction |
| Rust unsafe / panic DoS | external bytes, parsers, archive data, network input | `unsafe`, unchecked conversions, `unwrap`/`expect` on external data, pointer reads/writes | checked lengths, error returns, fuzz tests |
| Deserialization | network bytes, file input, IPC data, session cookies | Java `ObjectInputStream.readObject`, Python `pickle.loads`, Ruby `Marshal.load`, `YAML.load`, R `unserialize`, `.RData` load | class allowlists, `resolveClass`, safe deserialization libraries, schema validation |
| Race / TOCTOU | concurrent requests, shared file paths, shared state, task queues | check-then-act file ops, read-modify-write without lock, shared mutable map/list without sync | atomic file ops, mutex/lock, channel/actor serialization, immutable state |
| Integer overflow / out-of-bounds | external length fields, user sizes, C/JNI/FFI boundary values | unchecked arithmetic, array index from external int, Rust `as` cast, `from_raw_parts`, C `malloc(n * size)` | checked arithmetic, bounds assertions, safe cast wrappers, fuzz large/negative values |
| Auth bypass | session tokens, JWTs, API keys, OAuth flows, plugin config, CLI flags | skipped `verify`, JWT `none`, weak secret, missing role check, session fixation | signature validation, `sub`/`aud` checks, strong secrets, role allowlists, session binding |
| CSRF | HTML forms, state-changing endpoints, cookie sessions | `POST` without token, state-changing `GET`, missing `SameSite`, missing `Origin` check | CSRF token, double-submit cookie, `SameSite=Lax/Strict`, `Origin`/`Referer` validation |
| XXE | XML config, SOAP/REST payloads, SVG, Office docs, RSS | `DocumentBuilder`, `XMLReader`, `SAXParser`, `lxml`, `Nokogiri`, `XmlReader`, `XmlDocument` | disable DTD/entities, secure processing, safe parsers, reject external entities |
| SQL / NoSQL Injection | request params, GraphQL, CLI args, config values, search queries | raw SQL string concatenation, unsanitized `$where`, MongoDB `eval`, user-controlled query object | parameterized queries, ORM safe APIs, input allowlists, NoSQL query builders |
| SSTI | template strings from request/DB, email bodies, plugin themes | `render(template_string, user_data)`, Jinja2, ERB, Liquid, Handlebars from user input | fixed template lists, sandboxed renderers, disabled dangerous filters/tags, strict escaping |
| Sandbox escape | user code, plugin code, iframe src, worker scripts | `eval`, `vm.runInContext`, same-origin iframe, `postMessage` without origin check | strict allowlists, separate origin/process, capability sandbox, origin checks |
| Open Redirect | `next`, `redirect`, `returnUrl`, login callbacks, OAuth flows | `res.redirect(user_url)`, `http.Redirect`, `Location` header, `window.location = input` | allowlist domains, reject protocol-relative URLs, reject `javascript:`, registered callbacks |
| File upload bypass | multipart uploads, avatars, document imports, import by URL | MIME trust, extension blacklist, client-side-only checks, path traversal in filename | content sniffing, extension allowlist, file magic, hash rename, quarantine, size limit |
| Weak crypto | config files, env vars, handshakes, key generation | hardcoded keys, weak RNG, ECB, weak KDF, missing IV, static salt | key management, CSPRNG, AEAD, Argon2/scrypt, unique IV |
| Infoleak | errors, debug endpoints, logs, config exposure | stack traces, `?debug=1`, verbose logs, `.env`, path disclosure, panic messages | generic errors, disabled debug, sanitized logs, ignored secrets, security headers |

## Evidence Strength

- **High**: source reaches sink and guard is missing or obviously incomplete.
- **Medium**: source and sink are near each other, but reachability or guard quality needs confirmation.
- **Low**: risky API exists, but no clear untrusted source path is visible.

Record exact file/function evidence. If a path or function cannot be verified, write `未确认` and do not let that item dominate the ranking.
