# Example: Prototype Pollution in npm Package

This example shows a report for a package that recursively merges attacker-controlled objects into a normal object without blocking magic keys.

---

## VulDB Form

**Vendor**
```
example-utils project
```

**Product**
```
example-utils
```

**Version**
```
up to and including 2.4.1
```

**Class**
```
Prototype Pollution
```

**Description**
```
A prototype pollution vulnerability was found in the npm package example-utils up to and
including version 2.4.1. It has been classified as Prototype Pollution.

The issue affects the mergeDeep() function in src/merge.ts. The function recursively copies
user-supplied object keys into a target object without rejecting __proto__, constructor, or
prototype keys.

An attacker who can supply JSON input passed to mergeDeep() can modify Object.prototype,
resulting in unexpected properties appearing on unrelated objects. Exploitation requires that
an application passes attacker-controlled objects to the vulnerable merge helper. The attack
can be performed remotely when the application accepts untrusted JSON over the network.

Affected component: src/merge.ts
Affected function: mergeDeep()

Root cause: Recursive merge logic copies dangerous prototype keys without an allowlist or
explicit rejection rule.

Suggested fix: Reject __proto__, prototype, and constructor keys before recursion, and merge
only own enumerable properties into objects created with a safe prototype.
```

**Advisory / Exploit**
```
https://github.com/<user>/example-utils-prototype-pollution
```

**CVE checkbox**
Tick only after confirming vendor contact, no existing CVE/GHSA/OSV entry, and no other CNA submission.

---

## Full Advisory

**Title**
```
example-utils up to 2.4.1 mergeDeep prototype pollution
```

**Summary**

A prototype pollution vulnerability was found in `example-utils` up to and including version 2.4.1. It has been classified as CWE-1321.

**Affected Component**

| Field | Value |
|---|---|
| File | `src/merge.ts` |
| Function | `mergeDeep()` |
| Package | `npm:example-utils` |
| Version tested | 2.4.1 |
| Affected versions | up to and including 2.4.1 |
| Fixed version | none at time of reporting |

**Root Cause**

The recursive merge helper treats every attacker-supplied key as data. Keys such as `__proto__`, `constructor`, and `prototype` are not filtered before assignment, allowing writes to object prototypes rather than only to the intended target object.

**Impact**

An attacker who controls JSON input passed to `mergeDeep()` can pollute `Object.prototype`. Depending on how the host application reads object properties, this may lead to authorization bypass, configuration tampering, or denial of service. The library issue is exploitable only when the application passes untrusted objects to the merge helper.

**Attack Requirements**

- Attack vector: Network
- Authentication required: Depends on host application
- User interaction required: No
- Preconditions: Application merges attacker-controlled JSON with `mergeDeep()`
- Scope: Changed
- CVSS v3.1: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:L/A:N` — 6.4 Medium

**Proof of Concept**

Install:
```bash
npm install example-utils@2.4.1
```

Minimal reproducer:
```javascript
const { mergeDeep } = require("example-utils");

mergeDeep({}, JSON.parse('{"__proto__":{"polluted":"yes"}}'));
console.log({}.polluted);
```

Result: the program prints `yes`, showing that a property was written to `Object.prototype`.

**Suggested Fix**

Reject prototype-mutating keys before recursive assignment:

```javascript
const blocked = new Set(["__proto__", "prototype", "constructor"]);
if (blocked.has(key)) continue;
```

Use `Object.hasOwn()` checks while iterating and avoid merging untrusted values into normal objects when a null-prototype object is sufficient.

**References**

- Vulnerable code: `https://github.com/example/example-utils/blob/v2.4.1/src/merge.ts`
- CWE-1321: `https://cwe.mitre.org/data/definitions/1321.html`
