# Pattern Pack Reference

Use pattern packs when the request is framed around a research playbook or package type rather than a single vulnerability alias. Keep the pack name separate from `vuln_direction`; many packs span multiple vulnerability classes.

Each pack is a discovery filter plus a source -> sink -> guard checklist. Use it to choose candidates, then prove the candidate with exact code evidence.

## Playbook Table

| Pack | Useful aliases | Discovery hints | Sources | Sinks | Guards |
|---|---|---|---|---|---|
| `archive-extractor` | `traversal`, `race`, `overflow`, `unsafe` | zip, tar, unzip, extract, archive, package importer | archive entry names, filenames, symlinks, external size fields | filesystem writes, path joins, extraction helpers, allocation from entry size | normalize and base-prefix check, reject absolute paths, symlink policy, checked sizes |
| `renderer-pipeline` | `xss`, `ssti`, `sandbox`, `infoleak` | markdown, html, preview, sanitize, render, docs, email | markdown/HTML input, renderer plugins, user content blocks | raw HTML render, `innerHTML`, sanitizer bypass, template render | strict sanitizer config, escaping, safe renderer mode, disabled raw HTML |
| `template-engine` | `ssti`, `injection`, `sandbox`, `xss` | template, theme, mail merge, liquid, erb, handlebars, jinja | template strings, theme files, user-editable snippets | dynamic render from strings, eval-like filters, helper invocation | fixed template allowlist, sandboxed helpers, disabled dangerous filters, escaping |
| `config-loader` | `yaml`, `proto`, `deser`, `auth`, `crypto` | config, yaml, json, dotenv, rc, schema, plugin config | config files, environment maps, CLI overrides, JSON/YAML objects | unsafe loader, deep merge, object hook, secret/key parsing | schema validation, safe loader, key denylist, null-prototype objects, secret handling |
| `media-tool` | `ssrf`, `upload`, `overflow`, `infoleak`, `xxe` | image, svg, pdf, video, thumbnail, metadata, exif | uploaded files, remote media URLs, embedded metadata, SVG/XML | remote fetch, parser decode, thumbnailer shell, XML parser, native bindings | URL allowlist, file magic, parser sandbox, DTD disabled, bounded decode |
| `webhook-client` | `ssrf`, `redirect`, `auth`, `crypto` | webhook, callback, integration, notifier, bot, oauth | user-provided webhook URLs, callback targets, token config | HTTP client, redirect follow, signature verifier, callback redirect | scheme/host allowlist, private-IP block, redirect policy, signature validation |
| `upload-handler` | `upload`, `traversal`, `race`, `infoleak` | upload, multipart, avatar, import, attachment, file manager | multipart filenames, content types, temp files, user-supplied paths | extension checks, move/write, public storage, post-process parser | extension allowlist, content sniffing, hash rename, quarantine, atomic move |

## Discovery Rules

- Start with package registry and GitHub search terms from the pack's discovery hints.
- Prefer packages where the pack describes the primary feature, not incidental code.
- Avoid flagship framework cores unless the user explicitly asks for them.
- Keep candidates with multiple pack tags only when the code evidence supports each tag.
- Record the pack in `playbooks` and the likely bug class in `vuln_direction`.

## Evidence Rules

For each candidate, write one source -> sink -> guard note tied to the pack:

```text
archive-extractor: archive entry name -> extractEntry() writeFile sink -> base-prefix guard missing for symlink path
```

Evidence strength follows `references/shared/vuln-patterns.md`:

- High: pack source reaches a sink and the named guard is missing or incomplete.
- Medium: source and sink are present but reachability or guard order needs confirmation.
- Low: discovery hints match, but no exact source path is verified.

## Pack-Specific False Positive Checks

- `archive-extractor`: reject candidates that only read archives without writing files.
- `renderer-pipeline`: do not flag safe markdown renderers that escape raw HTML by default unless plugin config re-enables raw HTML.
- `template-engine`: distinguish developer-owned templates from user-controlled template strings.
- `config-loader`: do not treat static application config as attacker-controlled without a real user-controlled import path.
- `media-tool`: separate local-only command-line media tools from server-side upload or URL-fetch flows.
- `webhook-client`: callback URLs configured only by trusted admins are lower priority unless the package is an SDK used by multi-tenant apps.
- `upload-handler`: client-side checks are not guards; server-side allowlists and storage isolation are guards.

## Cross-Pack Follow-Up

When a candidate matches more than one pack, pick the pack with the clearest local validation path as the primary lane driver. Put the others in `playbooks`, but do not inflate score for duplicate evidence.
