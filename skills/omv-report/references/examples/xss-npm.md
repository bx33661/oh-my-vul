# Example: XSS in npm Package (canvg)

This is a fully filled report for a click-triggered XSS in an npm package. Use it as a reference for the expected output format and level of detail.

---

## Part A — VulDB Form

**Vendor**
```
canvg project
```

**Product**
```
canvg
```

**Version**
```
up to and including 4.0.3
```

**Class**
```
Cross-Site Scripting
```

**Description**
```
A cross-site scripting vulnerability was found in the npm package canvg up to and including
version 4.0.3. It has been classified as Cross-Site Scripting.

The issue affects the onClick() method in src/Document/AElement.ts. The method retrieves the
href attribute value of an SVG anchor element and passes it directly to window.open() without
validating the URI scheme.

An attacker who can supply arbitrary SVG content rendered by the application can craft an anchor
element with a javascript: URI. The vulnerability is triggered when the victim clicks the
rendered element on the canvas, resulting in script execution in the victim's browser context.
Exploitation requires user interaction. The attack can be performed remotely.

Affected component: src/Document/AElement.ts
Affected function: AElement.onClick()

Root cause: The href value is passed to window.open() without filtering dangerous URI schemes
such as javascript: or data:.

Suggested fix: Before calling window.open(), validate that the URI scheme is one of http:,
https:, or mailto:. Reject javascript: and data: URIs explicitly.
```

**Advisory / Exploit**
```
https://github.com/<user>/canvg/security/advisories/GHSA-xxxx-xxxx-xxxx
```

**CVE checkbox**
Tick only after confirming: vendor notified, no existing CVE on GHSA/NVD/Snyk, no other CNA processing.

---

## Part B — Full Advisory

**Title**
```
canvg up to 4.0.3 AElement.ts onClick javascript URI Cross-Site Scripting
```

**Summary**

A cross-site scripting vulnerability was found in the npm package `canvg` up to and including version 4.0.3. It has been classified as CWE-79.

**Affected Component**

| Field | Value |
|---|---|
| File | `src/Document/AElement.ts` |
| Function | `AElement.onClick()` |
| Package | `npm:canvg` |
| Version tested | 4.0.3 |
| Affected versions | up to and including 4.0.3 |
| Fixed version | none at time of reporting |

**Root Cause**

The `onClick()` method in `AElement.ts` reads the `href` attribute of the SVG `<a>` element and passes it directly to `window.open()`:

```typescript
onClick() {
  const href = this.getAttribute('href').getString();
  window.open(href);  // no scheme validation
}
```

Because no URI scheme check is performed, a `javascript:` URI provided by an attacker is executed by the browser when `window.open()` is called.

**Impact**

An attacker who can supply arbitrary SVG content rendered by the application can inject an anchor element with a `javascript:` URI. When the victim clicks the rendered element on the canvas, the JavaScript URI is executed in the victim's browser context, enabling session theft, DOM manipulation, or further phishing.

**Attack Requirements**

- Attack vector: Network
- Authentication required: No
- User interaction required: Yes (victim must click the rendered anchor)
- Preconditions: The application must render attacker-controlled SVG input using canvg with mouse interaction enabled
- Scope: Changed
- CVSS v3.1: `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` — 6.1 Medium

**Proof of Concept**

Install:
```bash
npm install canvg@4.0.3
```

Malicious SVG input:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">
  <a href="javascript:alert(document.domain)">
    <text x="20" y="50">Click me</text>
  </a>
</svg>
```

Minimal HTML to reproduce:
```html
<!DOCTYPE html>
<html>
<body>
  <canvas id="c" width="300" height="100"></canvas>
  <script type="module">
    import { Canvg } from 'https://cdn.jsdelivr.net/npm/canvg@4.0.3/+esm';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">
      <a href="javascript:alert(document.domain)">
        <text x="20" y="50">Click me</text>
      </a>
    </svg>`;
    const v = await Canvg.fromString(
      document.getElementById('c').getContext('2d'), svg
    );
    await v.render();
  </script>
</body>
</html>
```

Trigger: Open the HTML file in a browser and click the "Click me" text on the canvas.

Result: `alert()` fires displaying the page domain, confirming JavaScript execution.

**Reproduction Steps**

1. Save the HTML above as `poc.html`
2. Open `poc.html` in a browser (local file or served over HTTP)
3. Click the "Click me" text rendered on the canvas
4. Observe: `alert(document.domain)` executes

**Suggested Fix**

Validate the URI scheme before calling `window.open()`. Accept only safe schemes and reject dangerous ones:

```typescript
onClick() {
  const href = this.getAttribute('href').getString();
  const url = new URL(href, window.location.href);
  const allowedSchemes = ['http:', 'https:', 'mailto:'];
  if (!allowedSchemes.includes(url.protocol)) {
    return; // reject javascript:, data:, vbscript:, etc.
  }
  window.open(href);
}
```

**Vendor Contact**

- Reported via GitHub Security Advisory on [DATE]
- Vendor acknowledged on [DATE] / No response as of [DATE]

**References**

- Vulnerable code: `https://github.com/canvg/canvg/blob/v4.0.3/src/Document/AElement.ts`
- GitHub Security Advisory: [URL]
