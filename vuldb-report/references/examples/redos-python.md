# Example: ReDoS in Python Package

This example shows a report for a regular-expression denial of service in a Python package.

---

## VulDB Form

**Vendor**
```
example-validator project
```

**Product**
```
example-validator
```

**Version**
```
before 1.8.2
```

**Class**
```
Denial of Service
```

**Description**
```
A regular expression denial-of-service vulnerability was found in the Python package
example-validator before version 1.8.2. It has been classified as Denial of Service.

The issue affects the validate_email() function in example_validator/email.py. The function
applies a nested-quantifier regular expression to attacker-controlled input without bounding
input length or using a linear-time parser.

An attacker can submit a crafted email-like string that causes catastrophic backtracking,
resulting in excessive CPU consumption and request timeouts. Exploitation does not require
user interaction. Authentication requirements depend on the host application endpoint using
the validator.

Affected component: example_validator/email.py
Affected function: validate_email()

Root cause: The email validation regex contains nested repetition over overlapping character
classes and is applied to untrusted input without a length guard.

Suggested fix: Replace the regex with a linear-time parser or a simpler anchored expression,
and enforce a maximum input length before validation.
```

**Advisory / Exploit**
```
https://github.com/example/example-validator/security/advisories/GHSA-xxxx-xxxx-xxxx
```

**CVE checkbox**
Tick only after confirming vendor contact, no existing CVE, and no other CNA submission.

---

## Full Advisory

**Title**
```
example-validator before 1.8.2 validate_email regular expression Denial of Service
```

**Summary**

A regular expression denial-of-service vulnerability was found in `example-validator` before version 1.8.2. It has been classified as CWE-1333.

**Affected Component**

| Field | Value |
|---|---|
| File | `example_validator/email.py` |
| Function | `validate_email()` |
| Package | `PyPI:example-validator` |
| Version tested | 1.8.1 |
| Affected versions | before 1.8.2 |
| Fixed version | 1.8.2 |

**Root Cause**

`validate_email()` evaluates attacker-controlled strings with a nested-quantifier regex. Inputs with long repeated local-part segments cause catastrophic backtracking, keeping a worker process busy until the request times out.

**Impact**

An attacker who can submit values to an endpoint using `validate_email()` can consume CPU and degrade availability. The vulnerability does not allow code execution or data access, but repeated requests can exhaust application workers.

**Attack Requirements**

- Attack vector: Network
- Authentication required: Depends on host application
- User interaction required: No
- Preconditions: Host application validates attacker-controlled email strings with the vulnerable function
- Scope: Unchanged
- CVSS v3.1: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H` — 6.5 Medium

**Proof of Concept**

Install:
```bash
pip install example-validator==1.8.1
```

Minimal local reproducer:
```python
from example_validator import validate_email

payload = ("a." * 5000) + "!"
validate_email(payload)
```

Result: validation consumes excessive CPU compared with normal email input.

**Suggested Fix**

Set a strict maximum length before regex evaluation and replace the vulnerable regex with a linear-time parser or a simplified expression that avoids nested repetition.

**References**

- Vulnerable code: `https://github.com/example/example-validator/blob/1.8.1/example_validator/email.py`
- Fixed release: `https://github.com/example/example-validator/releases/tag/1.8.2`
- CWE-1333: `https://cwe.mitre.org/data/definitions/1333.html`
